import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/payment/stripe';
import type { AssessmentSession } from '@/types/diagnostic';

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

      // TODO: Replace with actual DB update once the persistence layer is built.
      // This should mark the AssessmentSession.status as 'paid' and store the
      // Stripe session ID as AssessmentSession.paymentId.
      const statusUpdate: Pick<AssessmentSession, 'status' | 'paymentId'> = {
        status: 'paid',
        paymentId: session.id,
      };

      console.log('[stripe:webhook] checkout.session.completed', {
        assessmentId,
        companyName,
        customerEmail,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
        stripeSessionId: session.id,
        statusUpdate,
      });

      break;
    }

    default:
      console.log(`[stripe:webhook] Unhandled event type: ${event.type}`);
  }

  // Acknowledge receipt — Stripe retries on non-2xx responses.
  return NextResponse.json({ received: true });
}
