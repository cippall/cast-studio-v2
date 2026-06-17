export class StripeWebhookNotFoundError extends Error {
  constructor(message = 'Stripe webhook secret is not configured') {
    super(message);
    this.name = 'StripeWebhookNotFoundError';
  }
}
