import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/payment/stripe';
import { getSession, updateSession } from '@/lib/db/store';
import { sendPaymentReceivedNotification, sendReportEmail } from '@/lib/email/sender';
import { formatIndustryName } from '@/lib/diagnostic/economic';

export const maxDuration = 30;

/**
 * Stripe sends the raw body, so we must NOT parse it as JSON before
 * passing it to signature verification.  Next.js App Router streams
 * the body, so we read it once with request.text().
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event;

  try {
    const rawBody = await request.text();
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const assessmentId = session.metadata?.assessmentId ?? session.client_reference_id;
      const companyName = session.metadata?.companyName ?? 'unknown';
      const customerEmail = session.customer_email ?? session.customer_details?.email ?? 'unknown';

      console.log('[stripe:webhook] checkout.session.completed', {
        assessmentId,
        companyName,
        customerEmail,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
        stripeSessionId: session.id,
      });

      // Mark the assessment session as paid
      if (assessmentId) {
        try {
          const existing = await getSession(assessmentId);
          const wasAlreadyPaid = existing?.status === 'paid';

          await updateSession(assessmentId, {
            status: 'paid',
            paymentId: session.id,
          });
          console.log(`[stripe:webhook] Session ${assessmentId} marked as paid`);

          if (!wasAlreadyPaid && existing) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diagnostic.rlkconsultingco.com';
            const amountUsd = session.amount_total ? Math.round(session.amount_total / 100) : 397;
            const reportUrl = `${appUrl}/report?sessionId=${assessmentId}`;

            // Operator notification (fire-and-forget)
            sendPaymentReceivedNotification({
              companyName: existing.companyProfile.companyName,
              industryLabel: formatIndustryName(existing.companyProfile.industry),
              revenue: existing.companyProfile.revenue,
              employeeCount: existing.companyProfile.employeeCount,
              executiveName: existing.companyProfile.executiveName,
              executiveTitle: existing.companyProfile.executiveTitle,
              executiveEmail: existing.companyProfile.executiveEmail,
              customerEmail: customerEmail === 'unknown' ? undefined : customerEmail,
              sessionId: assessmentId,
              reportUrl,
              paymentMethod: 'stripe',
              stripeSessionId: session.id,
              amountUsd,
              timestamp: new Date().toISOString(),
            }).catch((err) => {
              console.error('[stripe:webhook] operator notification failed:', err);
            });

            // Customer report delivery email (fire-and-forget)
            const recipientEmail = existing.companyProfile.executiveEmail
              || (customerEmail !== 'unknown' ? customerEmail : null);
            const result = existing.diagnosticResult;

            if (recipientEmail && result) {
              sendReportEmail({
                to: recipientEmail,
                recipientName: existing.companyProfile.executiveName || existing.companyProfile.companyName,
                companyName: existing.companyProfile.companyName,
                stageName: result.stageClassification.stageName,
                stageNumber: result.stageClassification.primaryStage,
                unrealizedValueLow: result.economicEstimate.unrealizedValueLow,
                unrealizedValueHigh: result.economicEstimate.unrealizedValueHigh,
                overallScore: result.overallScore,
                reportUrl,
                calendlyUrl: process.env.CALENDLY_URL,
              }).then((res) => {
                if (res.success) {
                  console.log(`[stripe:webhook] Report email sent to ${recipientEmail} (id: ${res.id})`);
                } else {
                  console.error(`[stripe:webhook] Report email failed: ${res.error}`);
                }
              }).catch((err) => {
                console.error('[stripe:webhook] Report email threw:', err);
              });
            } else {
              console.warn('[stripe:webhook] Skipping report email: missing recipient or diagnosticResult', {
                hasEmail: !!recipientEmail,
                hasResult: !!result,
                assessmentId,
              });
            }
          }
        } catch (err) {
          console.error(`[stripe:webhook] Failed to update session ${assessmentId}:`, err);
        }
      }

      break;
    }

    default:
      console.log(`[stripe:webhook] Unhandled event type: ${event.type}`);
  }

  // Acknowledge receipt. Stripe retries on non-2xx responses.
  return NextResponse.json({ received: true });
}

