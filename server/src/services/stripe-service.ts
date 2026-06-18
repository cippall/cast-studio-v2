import { StripeWebhookNotFoundError } from '../errors/stripe-error.js';

/**
 * Create a Stripe Checkout Session for wallet top-up.
 * Returns the session URL for redirect.
 * Throws 503 if Stripe is not configured.
 */
export async function createCheckoutSession(
  _amount: number,
  _workspaceId: string,
  _accountId: string,
  _baseUrl: string,
): Promise<{ sessionUrl: string; sessionId: string }> {
  throw Object.assign(
    new Error('Stripe is not configured. Set STRIPE_SECRET_KEY to enable top-up.'),
    { statusCode: 503 },
  );
}

/**
 * Verify and parse a Stripe webhook event.
 * Returns the parsed event for further processing.
 */
export async function verifyWebhookEvent(
  _payload: string,
  _signature: string,
): Promise<{ type: string; data: Record<string, unknown> }> {
  throw new StripeWebhookNotFoundError();
}
