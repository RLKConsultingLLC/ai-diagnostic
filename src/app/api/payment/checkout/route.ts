import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/payment/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assessmentId, companyName, email } = body;

    if (!assessmentId || !companyName || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: assessmentId, companyName, email' },
        { status: 400 }
      );
    }

    const { sessionId, url } = await createCheckoutSession({
      assessmentId,
      companyName,
      email,
    });

    return NextResponse.json({ sessionId, url });
  } catch (error) {
    console.error('Checkout session creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
