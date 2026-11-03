'use client';
import { paddleLocale } from '@briefluence/shared';

/**
 * Paddle.js v2 overlay checkout. The script, `Paddle.Environment.set`, `Paddle.Initialize` and
 * `Paddle.Checkout.open` follow https://developer.paddle.com/paddlejs/overview and
 * https://developer.paddle.com/paddlejs/methods/paddle-checkout-open. The subscription itself is
 * applied by the API from Paddle's webhook; the browser only opens the checkout.
 */
const SCRIPT = 'https://cdn.paddle.com/paddle/v2/paddle.js';

export interface PaddleClientConfig {
  environment: 'sandbox' | 'production';
  clientToken: string;
  demo: boolean;
}

export interface PaddleCheckoutPayload {
  priceId: string;
  customerEmail: string;
  customData: Record<string, string>;
}

interface PaddleEvent {
  name?: string;
}
interface PaddleJs {
  Environment: { set(env: 'sandbox'): void };
  Initialize(options: { token: string; eventCallback?: (e: PaddleEvent) => void }): void;
  Checkout: { open(options: Record<string, unknown>): void; close(): void };
}
declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

let loading: Promise<PaddleJs> | null = null;
let listener: ((e: PaddleEvent) => void) | null = null;

function load(cfg: PaddleClientConfig): Promise<PaddleJs> {
  if (loading) return loading;
  loading = new Promise<PaddleJs>((resolve, reject) => {
    const ready = () => {
      const P = window.Paddle;
      if (!P) return reject(new Error('Paddle.js did not load'));
      if (cfg.environment === 'sandbox') P.Environment.set('sandbox');
      // Initialize may only run once per page, so events go through one module-level listener.
      P.Initialize({ token: cfg.clientToken, eventCallback: (e) => listener?.(e) });
      resolve(P);
    };
    if (window.Paddle) return ready();
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = ready;
    s.onerror = () => reject(new Error('Paddle.js did not load'));
    document.head.appendChild(s);
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * Opens the overlay and resolves with `completed` once Paddle reports a successful payment, or
 * `closed` if the blogger closes it first. Pass a checkout payload (new subscription) or a
 * transaction id (update the card on an existing subscription).
 */
export async function openPaddleCheckout(
  cfg: PaddleClientConfig,
  what: { checkout: PaddleCheckoutPayload } | { transactionId: string },
  uiLocale: string,
): Promise<'completed' | 'closed'> {
  const P = await load(cfg);
  return new Promise((resolve) => {
    let completed = false;
    const finish = (r: 'completed' | 'closed') => {
      listener = null;
      resolve(r);
    };
    listener = (e) => {
      if (e.name === 'checkout.completed') {
        completed = true;
        // Give the success screen a moment, then close the overlay ourselves.
        window.setTimeout(() => {
          P.Checkout.close();
          finish('completed');
        }, 1500);
      }
      if (e.name === 'checkout.closed') finish(completed ? 'completed' : 'closed');
    };
    const settings = {
      displayMode: 'overlay',
      theme: 'light',
      locale: paddleLocale(uiLocale),
      allowLogout: false,
    };
    P.Checkout.open(
      'transactionId' in what
        ? { transactionId: what.transactionId, settings }
        : {
            items: [{ priceId: what.checkout.priceId, quantity: 1 }],
            customer: { email: what.checkout.customerEmail },
            customData: what.checkout.customData,
            settings,
          },
    );
  });
}
