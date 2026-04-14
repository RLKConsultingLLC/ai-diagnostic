// =============================================================================
// POST /api/payment/verify
// =============================================================================
// Inline payment verification for the success redirect.
// Handles the race condition where the webhook hasn't fired yet but the
// user has already landed on the success page.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/payment/stripe';
import { updateSession } from '@/lib/db/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stripeSessionId } = body as { stripeSessionId: string };

    if (!stripeSessionId) {
      return NextResponse.json(
        { error: 'stripeSessionId is required' },
        { status: 400 }
      );
    }

    const verification = await verifyPayment(stripeSessionId);

    if (verification.paid && verification.assessmentId) {
      // Mark the session as paid (idempotent — safe if webhook already did it)
      try {
        await updateSession(verification.assessmentId, {
          status: 'paid',
          paymentId: stripeSessionId,
        });
      } catch {
        // Session might not exist — that's OK, webhook will handle it
      }

      return NextResponse.json({
        paid: true,
        assessmentId: verification.assessmentId,
      });
    }

    return NextResponse.json({ paid: false });
  } catch (err: unknown) {
    console.error('[POST /api/payment/verify]', err);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
