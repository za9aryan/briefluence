import { Logger } from '@nestjs/common';
import { toMajor, type Currency } from '@briefluence/shared';
import type { Env } from '../../../config/env';
import type { ChargeInput, CheckoutInput, CheckoutResult, PaymentOutcome, PaymentProvider } from './types';

/**
 * Ameriabank vPOS 3.x REST API. There is no official Node SDK; request/response shapes follow
 * the unofficial https://github.com/hos/ameria-sdk-js (src/types.ts, src/client.ts) and Ameria's
 * vPOS API guide (request it from vpos.support@ameriabank.am).
 *  - All calls: POST {host}/api/VPOS/{Method}, JSON, with ClientID/Username/Password.
 *  - InitPayment → ResponseCode 1 on success, then redirect to {host}/Payments/Pay?id={PaymentID}.
 *  - GetPaymentDetails / MakeBindingPayment / RefundPayment → ResponseCode "00" on success.
 *  - Binding (recurring) payments must be enabled for the merchant by the bank first.
 *  - Test terminals only accept OrderIDs in a bank-assigned range (AMERIA_ORDER_ID_OFFSET) and
 *    usually a fixed small test amount.
 */
export class AmeriaProvider implements PaymentProvider {
  readonly name = 'ameriabank' as const;
  private readonly logger = new Logger(AmeriaProvider.name);
  private readonly host: string;

  constructor(private readonly env: Env) {
    this.host = env.AMERIA_TEST_MODE ? 'https://servicestest.ameriabank.am/VPOS' : 'https://services.ameriabank.am/VPOS';
  }

  /** ISO 4217 numeric codes as expected by vPOS. */
  private currencyCode(c: Currency) {
    return { AMD: '051', USD: '840', RUB: '643' }[c];
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.host}/api/VPOS/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        ClientID: this.env.AMERIA_CLIENT_ID,
        Username: this.env.AMERIA_USERNAME,
        Password: this.env.AMERIA_PASSWORD,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Ameria ${method} HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** Strip credentials and card data before storing provider responses. */
  private safeRaw(r: Record<string, unknown>) {
    const { Password: _p, Username: _u, ClientID: _c, ...rest } = r;
    return rest;
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    type R = { PaymentID: string; ResponseCode: number; ResponseMessage: string };
    const r = await this.call<R>('InitPayment', {
      OrderID: Number(input.orderId),
      Amount: toMajor(input.amount),
      Currency: this.currencyCode(input.currency),
      Description: input.description,
      BackURL: input.backUrl,
      CardHolderID: input.cardHolderId, // enables card binding for later MakeBindingPayment
      Opaque: input.cardHolderId,
    });
    if (r.ResponseCode !== 1 || !r.PaymentID) {
      throw new Error(`Ameria InitPayment failed: ${r.ResponseCode} ${r.ResponseMessage}`);
    }
    return {
      providerPaymentId: r.PaymentID,
      redirectUrl: `${this.host}/Payments/Pay?id=${encodeURIComponent(r.PaymentID)}&lang=en`,
      raw: this.safeRaw(r),
    };
  }

  async confirm(providerPaymentId: string): Promise<PaymentOutcome> {
    type R = {
      ResponseCode: string;
      OrderStatus: number;
      PaymentState: string;
      CardNumber: string;
      CardHolderID: string;
      Opaque: string;
      TrxnDescription: string;
    };
    const r = await this.call<R>('GetPaymentDetails', { PaymentID: providerPaymentId });
    const raw = this.safeRaw(r as unknown as Record<string, unknown>);
    if (r.ResponseCode === '00') {
      return {
        status: 'SUCCEEDED',
        providerPaymentId,
        bindingId: r.CardHolderID || r.Opaque,
        cardMask: r.CardNumber, // already masked by the bank, e.g. 4083****1234
        raw,
      };
    }
    // "0-100" = no payment attempt yet (user still on the bank page or abandoned it).
    if (r.ResponseCode === '0-100') return { status: 'PENDING', providerPaymentId, raw };
    return { status: 'FAILED', providerPaymentId, failureReason: r.TrxnDescription || r.ResponseCode, raw };
  }

  async chargeBinding(input: ChargeInput): Promise<PaymentOutcome> {
    type R = { PaymentID: string; ResponseCode: string; TrxnDescription: string; CardNumber: string };
    try {
      const r = await this.call<R>('MakeBindingPayment', {
        OrderID: Number(input.orderId),
        Amount: toMajor(input.amount),
        Currency: this.currencyCode(input.currency),
        Description: input.description,
        BackURL: input.backUrl,
        CardHolderID: input.bindingId,
        PaymentType: this.env.AMERIA_BINDING_PAYMENT_TYPE,
        Opaque: input.bindingId,
      });
      const raw = this.safeRaw(r as unknown as Record<string, unknown>);
      if (r.ResponseCode === '00') return { status: 'SUCCEEDED', providerPaymentId: r.PaymentID, cardMask: r.CardNumber, raw };
      return { status: 'FAILED', providerPaymentId: r.PaymentID, failureReason: r.TrxnDescription || r.ResponseCode, raw };
    } catch (err) {
      this.logger.error(`MakeBindingPayment error: ${(err as Error).message}`);
      return { status: 'FAILED', failureReason: 'Bank unavailable' };
    }
  }

  async refund(providerPaymentId: string, amount: number) {
    type R = { ResponseCode: string; ResponseMessage: string };
    const r = await this.call<R>('RefundPayment', { PaymentID: providerPaymentId, Amount: toMajor(amount) });
    return { ok: r.ResponseCode === '00', raw: r };
  }

  async removeBinding(bindingId: string) {
    type R = { ResponseCode: string; ResponseMessage: string };
    const r = await this.call<R>('DeactivateBinding', {
      CardHolderID: bindingId,
      PaymentType: this.env.AMERIA_BINDING_PAYMENT_TYPE,
    });
    if (r.ResponseCode !== '00') this.logger.warn(`DeactivateBinding returned ${r.ResponseCode} ${r.ResponseMessage}`);
  }
}
