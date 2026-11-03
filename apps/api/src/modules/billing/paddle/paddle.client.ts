import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PlanCode } from '@briefluence/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../../common/app-error';
import { ENV } from '../../../config/config.module';
import type { Env } from '../../../config/env';

/**
 * Paddle Billing API (https://developer.paddle.com/api-reference). Sandbox and live are separate
 * accounts; PADDLE_ENV picks the key set. Every request uses the server API key; the browser only
 * gets the client-side token (Paddle.js checkout).
 */
export interface PaddleConfig {
  environment: 'sandbox' | 'production';
  apiBase: string;
  apiKey: string;
  clientToken: string;
  webhookSecret: string;
  /** Price used when checking out each Pro plan (sandbox "monthly" = the 1-day demo price). */
  prices: Record<'PRO_MONTHLY' | 'PRO_YEARLY', string>;
  /** Every price id we know → plan (monthly and demo both mean PRO_MONTHLY). */
  planByPrice: Map<string, PlanCode>;
  /** Sandbox demo mode: 1 hour of free Pro, simulate buttons for admins. */
  demo: boolean;
}

export function paddleConfig(env: Env): PaddleConfig | null {
  if (env.PAYMENT_PROVIDER !== 'paddle') return null;
  const live = env.PADDLE_ENV === 'production';
  const monthly = live
    ? env.PADDLE_LIVE_PRICE_MONTHLY!
    : (env.PADDLE_SANDBOX_PRICE_DEMO ?? env.PADDLE_SANDBOX_PRICE_MONTHLY!);
  const yearly = live ? env.PADDLE_LIVE_PRICE_YEARLY! : env.PADDLE_SANDBOX_PRICE_YEARLY!;
  const planByPrice = new Map<string, PlanCode>([
    [monthly, 'PRO_MONTHLY'],
    [yearly, 'PRO_YEARLY'],
  ]);
  if (!live && env.PADDLE_SANDBOX_PRICE_MONTHLY)
    planByPrice.set(env.PADDLE_SANDBOX_PRICE_MONTHLY, 'PRO_MONTHLY');
  return {
    environment: env.PADDLE_ENV,
    apiBase: live ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com',
    apiKey: (live ? env.PADDLE_LIVE_API_KEY : env.PADDLE_SANDBOX_API_KEY)!,
    clientToken: (live ? env.PADDLE_LIVE_CLIENT_TOKEN : env.PADDLE_SANDBOX_CLIENT_TOKEN)!,
    webhookSecret: (live ? env.PADDLE_LIVE_WEBHOOK_SECRET : env.PADDLE_SANDBOX_WEBHOOK_SECRET)!,
    prices: { PRO_MONTHLY: monthly, PRO_YEARLY: yearly },
    planByPrice,
    demo: !live,
  };
}

/**
 * `Paddle-Signature: ts=…;h1=…`: HMAC-SHA256 of `${ts}:${rawBody}` with the destination's secret.
 * Several h1 values may be present while a secret rotates. Rejects events older than `toleranceSec`.
 * https://developer.paddle.com/webhooks/about/signature-verification
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowSec: number,
  toleranceSec = 300,
): boolean {
  if (!header) return false;
  const parts = header.split(';').map((p) => p.split('='));
  const ts = parts.find(([k]) => k === 'ts')?.[1];
  const signatures = parts.filter(([k]) => k === 'h1').map(([, v]) => v ?? '');
  if (!ts || !signatures.length) return false;
  if (Math.abs(nowSec - Number(ts)) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  const want = Buffer.from(expected, 'hex');
  return signatures.some((s) => {
    const got = Buffer.from(s, 'hex');
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

/** The parts of Paddle's subscription entity we use (field names from the API reference). */
export interface PaddleSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';
  customer_id: string;
  custom_data: Record<string, unknown> | null;
  current_billing_period: { starts_at: string; ends_at: string } | null;
  scheduled_change: { action: 'cancel' | 'pause' | 'resume'; effective_at: string } | null;
  items: { price: { id: string } }[];
}

export interface PaddleNotificationSetting {
  id: string;
  destination: string;
  active: boolean;
  traffic_source?: 'platform' | 'simulation' | 'all';
}

@Injectable()
export class PaddleClient {
  private readonly logger = new Logger(PaddleClient.name);
  readonly config: PaddleConfig | null;

  constructor(@Inject(ENV) env: Env) {
    this.config = paddleConfig(env);
  }

  private get cfg(): PaddleConfig {
    if (!this.config) throw new AppError('PROVIDER_ERROR', 'Paddle is not configured');
    return this.config;
  }

  /** Paddle wraps responses in `{ data }` and errors in `{ error: { code, detail } }`. */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.apiBase}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: T;
      error?: { code?: string; detail?: string };
    } | null;
    if (!res.ok || !json || json.data === undefined) {
      const code = json?.error?.code ?? String(res.status);
      this.logger.error(`Paddle ${method} ${path} failed: ${code} ${json?.error?.detail ?? ''}`);
      throw new AppError('PROVIDER_ERROR', 'The payment provider did not accept the request', {
        code,
      });
    }
    return json.data;
  }

  getSubscription(id: string) {
    return this.request<PaddleSubscription>('GET', `/subscriptions/${id}`);
  }

  /** https://developer.paddle.com/api-reference/subscriptions/cancel-subscription */
  cancel(id: string, effectiveFrom: 'next_billing_period' | 'immediately') {
    return this.request<PaddleSubscription>('POST', `/subscriptions/${id}/cancel`, {
      effective_from: effectiveFrom,
    });
  }

  /** Turn renewal back on: remove the scheduled cancel (only `null` is allowed here). */
  removeScheduledChange(id: string) {
    return this.request<PaddleSubscription>('PATCH', `/subscriptions/${id}`, {
      scheduled_change: null,
    });
  }

  /**
   * Monthly ↔ yearly: replace the price; `full_next_billing_period` = no proration now, the next
   * renewal charges the full new price. https://developer.paddle.com/api-reference/subscriptions/update-subscription
   */
  changePrice(id: string, priceId: string) {
    return this.request<PaddleSubscription>('PATCH', `/subscriptions/${id}`, {
      items: [{ price_id: priceId, quantity: 1 }],
      proration_billing_mode: 'full_next_billing_period',
    });
  }

  /** A transaction Paddle.js opens so the customer can update their card. */
  updatePaymentMethodTransaction(id: string) {
    return this.request<{ id: string }>(
      'GET',
      `/subscriptions/${id}/update-payment-method-transaction`,
    );
  }

  listNotificationSettings() {
    return this.request<PaddleNotificationSetting[]>('GET', '/notification-settings');
  }

  setTrafficSource(id: string, source: 'platform' | 'simulation' | 'all') {
    return this.request<PaddleNotificationSetting>('PATCH', `/notification-settings/${id}`, {
      traffic_source: source,
    });
  }

  /** https://developer.paddle.com/api-reference/simulations/create-simulation */
  createSimulation(body: Record<string, unknown>) {
    return this.request<{ id: string }>('POST', '/simulations', body);
  }

  runSimulation(simulationId: string) {
    return this.request<{ id: string; status: string }>(
      'POST',
      `/simulations/${simulationId}/runs`,
    );
  }
}
