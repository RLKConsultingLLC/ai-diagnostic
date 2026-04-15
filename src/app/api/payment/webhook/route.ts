import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/payment/stripe';
import { getSession, updateSession } from '@/lib/db/store';
import { sendReportEmail } from '@/lib/email/sender';
import { generateReportPDF } from '@/lib/pdf/generator';

// Webhook needs time for PDF generation + email send
export const maxDuration = 120;

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
          await updateSession(assessmentId, {
            status: 'paid',
            paymentId: session.id,
          });
          console.log(`[stripe:webhook] Session ${assessmentId} marked as paid`);

          // Send report email with PDF attachment
          await sendReportWithPDF(assessmentId, customerEmail);
        } catch (err) {
          console.error(`[stripe:webhook] Failed to update session ${assessmentId}:`, err);
        }
      }

      break;
    }

    default:
      console.log(`[stripe:webhook] Unhandled event type: ${event.type}`);
  }

  // Acknowledge receipt — Stripe retries on non-2xx responses.
  return NextResponse.json({ received: true });
}

/**
 * Generate PDF and send branded email after successful payment.
 */
async function sendReportWithPDF(assessmentId: string, fallbackEmail: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[stripe:webhook] Skipping email — RESEND_API_KEY not configured');
    return;
  }

  try {
    const session = await getSession(assessmentId);
    if (!session) {
      console.error(`[stripe:webhook] Session ${assessmentId} not found for email`);
      return;
    }

    const result = session.diagnosticResult;
    const report = session.generatedReport;

    if (!result || !report) {
      console.log(`[stripe:webhook] Report not yet generated for ${assessmentId} — skipping email`);
      return;
    }

    // Determine recipient
    const email = session.companyProfile.executiveEmail || fallbackEmail;
    if (!email || email === 'unknown') {
      console.log('[stripe:webhook] No email address available — skipping');
      return;
    }

    // Generate the PDF
    console.log(`[stripe:webhook] Generating PDF for ${session.companyProfile.companyName}...`);
    const pdfBuffer = await generateReportPDF(report, result);
    console.log(`[stripe:webhook] PDF generated (${(pdfBuffer.length / 1024).toFixed(0)}KB)`);

    // Build report URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-diagnostic-silk.vercel.app';
    const reportUrl = `${appUrl}/report?sessionId=${assessmentId}`;

    // Send the email
    const emailResult = await sendReportEmail({
      to: email,
      recipientName: session.companyProfile.executiveName || 'Executive',
      companyName: session.companyProfile.companyName,
      stageName: result.stageClassification.stageName,
      stageNumber: result.stageClassification.primaryStage,
      unrealizedValueLow: result.economicEstimate.unrealizedValueLow,
      unrealizedValueHigh: result.economicEstimate.unrealizedValueHigh,
      overallScore: result.overallScore,
      reportUrl,
      pdfBuffer,
    });

    if (emailResult.success) {
      console.log(`[stripe:webhook] Report email sent to ${email} (id: ${emailResult.id})`);
    } else {
      console.error(`[stripe:webhook] Email failed: ${emailResult.error}`);
    }
  } catch (err) {
    // Don't fail the webhook if email fails
    console.error('[stripe:webhook] Email/PDF error:', err);
  }
}
