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

## Plans

Pro plans are Paddle prices: the amount, currency and active/archived state are read from Paddle (cached 5 minutes,
fresh on every visit to Admin → Plans), so the site always shows what checkout charges. Change them in Paddle →
Catalog → Products. Basic (free) and its limits are edited in Admin → Plans. Choosing Pro creates nothing on our side
until Paddle confirms the payment; the webhook then creates or updates the blogger's subscription.

- **Basic** is free from the moment it is chosen.
- **Pro monthly / yearly** is charged at checkout; the paid period starts that day.
- **Free month**: every account can activate one month of Pro (no card, nothing charged afterwards) from a banner in
  Billing, whenever it wants. Buying Pro during it ends it the same day: the blogger confirms this first and the
  remaining free days are not added later.

## Coupons

Admin → Coupons creates a Paddle discount (https://developer.paddle.com/api-reference/discounts/create-discount)
and keeps a copy for checks and statistics:

- _Free Pro_: 100% off Pro monthly for N months. _Discount_: X% off for N payments (or every payment) on the chosen
  Pro plans. `maximum_recurring_intervals` = N counts the first payment ("set for 4 billing periods applies to the
  initial transaction and the next 3 renewals"); N = 1 is `recur: false`.
- Uses: once (`usage_limit: 1`), a number, or no limit. Paddle's limit is a total for all customers, so "one coupon
  per account" is checked by us before checkout. On/off = Paddle status `active` / `archived`.
- Bloggers enter the code in Billing; we check it and open Paddle's checkout with its `discountId`. Paddle's own
  "add discount" field is hidden (`showAddDiscounts: false`), so codes can't bypass our checks. A card is collected
  and charged when the discount ends, unless the blogger cancels. Buying with a coupon during the free month ends it.
- Statistics: uses come from `transaction.completed` events carrying `discount_id` (one redemption per account);
  "paid after" and conversion from our payment records; Paddle's own `times_used` is shown on each coupon.
- Verify in the sandbox before going live that a 100% first payment still asks for a card.

## Demo (sandbox) vs live

`PAYMENT_PROVIDER=paddle` turns Paddle on. `PADDLE_ENV` picks the account:

|                   | `sandbox` (demo)                                                                | `production` (live)     |
| ----------------- | ------------------------------------------------------------------------------- | ----------------------- |
| Keys              | `PADDLE_SANDBOX_*`                                                              | `PADDLE_LIVE_*`         |
| Free month of Pro | 1 hour                                                                          | 30 days                 |
| Plans offered     | Pro daily (test, `PADDLE_SANDBOX_PRICE_DEMO`), Pro monthly, Pro yearly          | Pro monthly, Pro yearly |
| Cards             | test card `4242 4242 4242 4242`, any future date, any CVC                       | real cards              |
| Admin → Payments  | "Paddle test mode" panel: simulate a paid renewal, failed renewal, cancellation | hidden                  |

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
