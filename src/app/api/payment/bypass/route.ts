// =============================================================================
// POST /api/payment/bypass
// =============================================================================
// Accepts a promo code and, if valid, marks the session as paid without
// going through Stripe. Used for internal testing and demo purposes.
// Also triggers the report email with PDF attachment.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';

export const maxDuration = 30;

// The bypass code is stored in an env var so it's never in source code.
// Set BYPASS_PROMO_CODE in .env.local (e.g., BYPASS_PROMO_CODE=RLK-DEMO-2026)
function getValidCodes(): string[] {
  const code = process.env.BYPASS_PROMO_CODE;
  if (!code) return [];
  // Support comma-separated codes for multiple testers
  return code.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, promoCode } = body as {
      sessionId: string;
      promoCode: string;
    };

    if (!sessionId || !promoCode) {
      return NextResponse.json(
        { error: 'sessionId and promoCode are required' },
        { status: 400 }
      );
    }

    const validCodes = getValidCodes();
    if (validCodes.length === 0) {
      return NextResponse.json(
        { error: 'Promo codes are not configured' },
        { status: 403 }
      );
    }

    if (!validCodes.includes(promoCode.trim().toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid promo code' },
        { status: 403 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Mark as paid with a bypass identifier
    await updateSession(sessionId, {
      status: 'paid',
      paymentId: `bypass:${promoCode.trim().toUpperCase()}`,
    });

    console.log('[payment:bypass] Session unlocked', {
      sessionId,
      companyName: session.companyProfile.companyName,
      code: promoCode.trim().toUpperCase(),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[POST /api/payment/bypass]', err);
    return NextResponse.json(
      { error: 'Failed to process promo code' },
      { status: 500 }
    );
  }
}
