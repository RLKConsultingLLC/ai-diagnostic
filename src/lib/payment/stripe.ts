import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

const DEFAULT_PRICE_CENTS = 49700; // $497.00

interface CreateCheckoutParams {
  assessmentId: string;
  companyName: string;
  email: string;
  priceId?: string;
}

interface CheckoutResult {
  sessionId: string;
  url: string;
}

interface PaymentVerification {
  paid: boolean;
  assessmentId: string;
  customerEmail: string;
}

/**
 * Creates a Stripe Checkout session for the diagnostic report purchase.
 * Default price is $497 one-time payment unless a specific priceId is provided.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const { assessmentId, companyName, email, priceId } = params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    customer_email: email,
    client_reference_id: assessmentId,
    success_url: `${appUrl}/report?sessionId=${assessmentId}&stripe_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/report?sessionId=${assessmentId}&canceled=true`,
    metadata: {
      assessmentId,
      companyName,
    },
  };

  if (priceId) {
    // Use a pre-configured Stripe Price object
    sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
  } else {
    // Inline price: $497 one-time
    sessionConfig.line_items = [
      {
        price_data: {
          currency: 'usd',
          unit_amount: DEFAULT_PRICE_CENTS,
          product_data: {
            name: 'RLK AI Diagnostic | Full Report',
            description: `AI readiness diagnostic report for ${companyName}`,
          },
        },
        quantity: 1,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Verifies that a Checkout session has been paid.
 */
export async function verifyPayment(
  sessionId: string
): Promise<PaymentVerification> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  return {
    paid: session.payment_status === 'paid',
    assessmentId: (session.metadata?.assessmentId ?? session.client_reference_id) || '',
    customerEmail: (session.customer_email ?? session.customer_details?.email) || '',
  };
}

/**
 * Constructs a Stripe webhook event from the raw body and signature header.
 * Exported for use in the webhook route handler.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
