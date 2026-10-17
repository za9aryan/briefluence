import type { Currency } from '@briefluence/shared';

export interface CheckoutInput {
  orderId: string;
  amount: number; // minor units
  currency: Currency;
  description: string;
  backUrl: string;
  /** Our identifier for the card binding (Ameria "CardHolderID"); reused for recurring charges. */
  cardHolderId: string;
}

export interface CheckoutResult {
  providerPaymentId: string;
  redirectUrl: string;
  raw?: unknown;
}

export interface PaymentOutcome {
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  providerPaymentId?: string;
  /** Identifier used for future binding charges (we use our CardHolderID). */
  bindingId?: string;
  cardMask?: string;
  failureReason?: string;
  raw?: unknown;
}

export interface ChargeInput extends Omit<CheckoutInput, 'cardHolderId'> {
  bindingId: string;
}

/** The spec's provider contract: createCheckout, confirm, chargeBinding, refund (+ removeBinding). */
export interface PaymentProvider {
  readonly name: 'ameriabank' | 'mock';
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Server-to-server confirmation; never trust redirect query params. */
  confirm(providerPaymentId: string): Promise<PaymentOutcome>;
  chargeBinding(input: ChargeInput): Promise<PaymentOutcome>;
  refund(providerPaymentId: string, amount: number, currency: Currency): Promise<{ ok: boolean; raw?: unknown }>;
  removeBinding(bindingId: string): Promise<void>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
