# Paddle payments (blogger Pro)

Paddle is our reseller (merchant of record): it shows the checkout, charges the card, runs renewals and retries,
and tells us what happened by webhook. We never see card numbers.

- Checkout: Paddle.js overlay opened from **Plan & billing** and the plan picker
  (https://developer.paddle.com/paddlejs/methods/paddle-checkout-open).
- Webhook: `POST {WEB_URL}/api/v1/billing/paddle/webhook`, signed with `Paddle-Signature`
  (https://developer.paddle.com/webhooks/about/signature-verification). Caddy sends this path straight to the API.
- Events we use: `subscription.created/activated/updated/past_due/paused/resumed/canceled`, `transaction.completed`,
  `transaction.payment_failed`. Each event is applied once (`BillingEvent`), older events never overwrite newer ones.
- Cancel / renew again / monthly ↔ yearly / change card go through the Paddle API; the daily job reconciles linked
  subscriptions with Paddle.

## Demo (sandbox) vs live

`PAYMENT_PROVIDER=paddle` turns Paddle on. `PADDLE_ENV` picks the account:

|                                | `sandbox` (demo)                                                                | `production` (live)         |
| ------------------------------ | ------------------------------------------------------------------------------- | --------------------------- |
| Keys                           | `PADDLE_SANDBOX_*`                                                              | `PADDLE_LIVE_*`             |
| Free Pro after choosing a plan | 1 hour                                                                          | 30 days                     |
| Pro "monthly" price            | `PADDLE_SANDBOX_PRICE_DEMO` (renews daily)                                      | `PADDLE_LIVE_PRICE_MONTHLY` |
| Cards                          | test card `4242 4242 4242 4242`, any future date, any CVC                       | real cards                  |
| Admin → Payments               | "Paddle test mode" panel: simulate a paid renewal, failed renewal, cancellation | hidden                      |

Simulations are delivered only to a destination whose traffic source includes simulations; the API switches the
destination to "all" on the first simulation.

## Setup (per account; do the same in live later)

1. Catalog → Products: one product "briefluence Pro" with prices: monthly, yearly (and in sandbox a daily demo price).
2. Developer tools → Authentication: an API key (`pdl_…`) and a client-side token (`test_…` / `live_…`).
3. Developer tools → Notifications: a destination `{WEB_URL}/api/v1/billing/paddle/webhook` with the events above;
   copy its secret key.
4. Checkout → Checkout settings: default payment link = `{WEB_URL}/influencer/billing`; approve the domain (live).
5. Put the ids and keys into the server `.env` (see `deploy/oracle/.env.example`) and restart the API.

## Going live

Fill `PADDLE_LIVE_*`, set `PADDLE_ENV=production`, restart. Before that Paddle must approve the domain, which needs
public pricing, Terms naming Paddle as the merchant of record, and a refund policy page.
