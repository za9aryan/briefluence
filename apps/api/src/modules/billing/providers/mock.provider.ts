import { randomUUID } from 'node:crypto';
import type { Env } from '../../../config/env';
import type { ChargeInput, CheckoutInput, CheckoutResult, PaymentOutcome, PaymentProvider } from './types';

export type MockCard = 'success' | 'decline' | 'renewal_decline';

/**
 * Local stand-in for the bank. Checkout redirects to the web app's fake payment page
 * (/billing/mock-checkout), which reports the chosen outcome back via POST /billing/mock/complete.
 * The chosen card is encoded in the binding id so renewals behave consistently across restarts.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  private readonly outcomes = new Map<string, { card: MockCard; cardHolderId: string }>();
  private readonly checkouts = new Map<string, { cardHolderId: string; backUrl: string }>();

  constructor(private readonly env: Env) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const providerPaymentId = `mock_${randomUUID()}`;
    this.checkouts.set(providerPaymentId, { cardHolderId: input.cardHolderId, backUrl: input.backUrl });
    const q = new URLSearchParams({ paymentID: providerPaymentId, amount: String(input.amount), currency: input.currency });
    return { providerPaymentId, redirectUrl: `${this.env.WEB_URL}/billing/mock-checkout?${q}` };
  }

  /** Called by the fake bank page. Returns the back URL to continue to. */
  complete(providerPaymentId: string, card: MockCard): string | null {
    const c = this.checkouts.get(providerPaymentId);
    if (!c) return null;
    this.outcomes.set(providerPaymentId, { card, cardHolderId: c.cardHolderId });
    return `${c.backUrl}?paymentID=${encodeURIComponent(providerPaymentId)}`;
  }

  async confirm(providerPaymentId: string): Promise<PaymentOutcome> {
    const o = this.outcomes.get(providerPaymentId);
    if (!o) return { status: 'PENDING', providerPaymentId };
    if (o.card === 'decline') return { status: 'FAILED', providerPaymentId, failureReason: 'Card declined (mock)' };
    return {
      status: 'SUCCEEDED',
      providerPaymentId,
      bindingId: `mock-${o.card}-${o.cardHolderId}`,
      cardMask: o.card === 'success' ? '4111********1111' : '4000********0002',
      raw: { mock: true },
    };
  }

  async chargeBinding(input: ChargeInput): Promise<PaymentOutcome> {
    if (input.bindingId.startsWith('mock-renewal_decline-')) {
      return { status: 'FAILED', providerPaymentId: `mock_${randomUUID()}`, failureReason: 'Insufficient funds (mock)' };
    }
    return { status: 'SUCCEEDED', providerPaymentId: `mock_${randomUUID()}`, raw: { mock: true } };
  }

  async refund() {
    return { ok: true };
  }

  async removeBinding() {}
}
