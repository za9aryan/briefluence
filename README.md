# briefluence

Marketplace where brands post promo briefs for free and verified bloggers pay a monthly subscription
(first month free) to apply. Launch market: Armenia. UI in English, Russian and Armenian.

```
apps/web        Next.js 16 (App Router) — all three role areas, next-intl (en/ru/hy)
apps/api        NestJS 11 + Prisma 6 (PostgreSQL 16), BullMQ jobs, Swagger at /api/docs
packages/shared Zod schemas, enums, pure domain logic (matching, subscription, lifecycles) + tests
packages/ui     Design system on the brand book: tokens, primitives (Block, Stack, Grid, Typography, Icon…), components
```

## Run locally

Requirements: Node 22+ and pnpm 9. PostgreSQL 16 either via Docker or the bundled embedded Postgres.

```bash
pnpm install
cp .env.example .env            # then set real secrets (see comments in the file)

# Database — pick one
docker compose up -d            # postgres + redis + mailpit
pnpm db:local                   # or: embedded PostgreSQL 16 without Docker (keeps running)

pnpm db:migrate                 # apply migrations
pnpm db:seed                    # demo data — only on an empty/demo database (see below)
pnpm dev                        # web on :3000, API on :4000
```

- Web: http://localhost:3000 · API docs: http://localhost:4000/api/docs
- Without `REDIS_URL` jobs run in-process (dev only). Set it to use BullMQ; run a separate worker with
  `PROCESS_ROLE=worker node apps/api/dist/worker.js` and the API with `PROCESS_ROLE=api`.
- With `EMAIL_TRANSPORT=log` emails are saved as HTML in `apps/api/.emails/` (verification and reset links are there).
  With Docker, set `EMAIL_TRANSPORT=smtp` and open Mailpit at http://localhost:8025.
- `SOCIAL_MOCK=true` fakes Instagram/TikTok/YouTube OAuth with generated stats; `PAYMENT_PROVIDER=mock` replaces
  the Ameriabank page with a test page (cards: always succeeds / renewals decline / declined).

### Seeded logins

| Role    | Email                                      | Password                                                  |
| ------- | ------------------------------------------ | --------------------------------------------------------- |
| Admin   | admin@briefluence.local                    | Admin12345 (from `.env`)                                  |
| Brand   | brand1…brand5@briefluence.local            | Password123                                               |
| Blogger | influencer1…influencer30@briefluence.local | Password123 (1–24 verified, 25–27 in review, 28–30 draft) |

## Your data is safe

- `pnpm db:seed` **refuses** to run when the database has real accounts (anything not `…@briefluence.local`).
  To deliberately start over with demo data: `pnpm db:reset-demo` — it saves a backup first.
- `pnpm db:backup [file]` saves the whole database to `backups/…json` (no pg_dump needed; works locally,
  in Docker and on Render). `pnpm db:restore <file> --yes` puts it back (replaces current data; run
  `pnpm db:migrate` first if the schema changed).
- Migrations never drop your data without copying it first.
- Browser E2E tests use their own servers (:4100 / :3100) and database `briefluence_e2e`; API tests use
  `briefluence_test`. Neither touches your dev database.

## Sign in with Google / Apple

The login and sign-up pages have "Continue with Google / Apple". Locally they are simulated (`OAUTH_LOGIN_MOCK=true`): you type any email on a test page. To make them real, see [docs/social-login-setup.md](docs/social-login-setup.md).

## Manually added social accounts

Besides connecting through the official login, a blogger can **Add manually** on the Verification page:
platform, username and followers are required; views, engagement and audience are optional. These accounts are
never synced, can be edited by the blogger, and carry an **Added manually** label for admins and brands.

Each blogger can have one account per platform (enforced in the database). Every social account (connected or
manual) is reviewed by an admin before it counts: accounts must be public
and their content fine for brands. Accounts present at the first profile review are approved with the profile;
accounts added later go to **Admin → Accounts**. Until approved, an account is not used for matching, applying
or shown to brands. Changing a manual account's platform or username, or fixing a rejected one, sends it back.

## Blogger plans

- **Basic**: free, a limited number of applications per rolling 30 days (default 10).
- **Pro** (monthly) and **Pro yearly**: unlimited applications.

Every blogger picks a plan and first gets **30 days of Pro for free**. Choosing Pro opens the bank page right away;
the paid period starts when the free days end. Without payment (or after a cancelled / failed renewal) the blogger
moves to Basic — nobody loses access. Prices, currency, Basic's limit and which Pro plans are offered are edited in
**Admin → Plans**. Prices are never shown on public pages.

On the billing page a paid Pro shows its renewal state: **Cancel subscription** (Pro stays until the paid period
ends, then Basic), **Turn renewal back on**, and **Switch to Pro yearly / monthly**, which takes effect at the next
renewal (charged then, no double charge). If the card was removed, **Renew** buys the next period of either Pro
plan, starting when the paid one ends. The 30 free Pro days are given once per account.

## Blogger offers

Besides applying to briefs, bloggers can publish **offers** ("1 Story for 10,000 AMD", "Long-term work with real
estate brokers"): title, description, price or "price on request", one-off / long-term, platforms, formats, niches
and who they want to work with. Offers are reviewed by admins (**Admin → Offer review**) like briefs. Brands browse
them in **Blogger offers**, send a request with a message (and an optional budget); the blogger accepts or
declines, and on accept both see each other's contacts. Views are counted once per brand per day. Basic allows a
limited number of live offers (default 1, **Admin → Plans**); Pro is unlimited. Accepting requests does not use
Basic's application limit.

## Portfolio and "About your work"

In **Settings** bloggers keep up to 12 portfolio items: one image (uploaded, `uploads/portfolio`), a title, an
optional description and an optional link (Reel, TikTok, YouTube, a site). We store only the image and the URL; no
video hosting. Every item is reviewed by an admin (**Admin → Portfolio**) before brands see it, and any edit sends it
back to review. When applying, a blogger can attach up to 3 approved items; brands see them on the application and
on the blogger's profile. Three optional questions (brands worked with, audience, brands wanted) appear to brands
only when answered.

## Support chat

A chat button sits in the bottom-right corner of every page (not for admins) and `/support` shows
the same chat full size.

- **Signed-in users** pick a topic (Account, Payments, Briefs & offers, Other) and write; one open
  conversation at a time. Replies arrive in the chat, as a notification and by email.
- **Visitors who are not signed in** (including blocked users) give an email; an httpOnly
  `bf_support` cookie keeps the conversation in that browser, and every admin reply is emailed with
  a secret `/support?t=…` link that continues the chat on any device. Guests can attach images too.
  Spam guards: hidden honeypot field, 3 new conversations per email and 20 per IP a day, 20
  messages per conversation per 10 minutes, request throttling.
- **Admins** work in **Admin → Support**: Unassigned / Mine / All open / Closed, assign to
  themselves or another admin, reply (the first admin to reply becomes the assignee), close or
  reopen. The side panel shows who is asking — for a guest, the account that owns the email, e.g.
  a **blocked** one.
- Statuses: Open (waiting for support) → Answered (waiting for the user) → Closed. A user reply
  reopens Answered; Answered tickets with no reply for 7 days close automatically (daily job
  `support-autoclose`).
- **Live updates** use the app-wide WebSocket channel (see "Live updates" below). Messages are sent through the REST
  API; the socket only says "ticket X changed" and clients reload it, so no content travels over
  the socket. In production Caddy routes `/api/v1/ws/*` to the API; locally the browser connects to
  the API port directly (`NEXT_PUBLIC_SOCKET_ORIGIN`).

## Live updates

One WebSocket channel (Socket.IO at `/api/v1/ws`, module `apps/api/src/realtime`) serves the whole
app. It authenticates with the same cookies as the API and only carries ids and kinds:

- `notifications:update` — to the user's own room: a new notification (the bell updates and the
  current page reloads its data, e.g. a new applicant appears) or notifications read in another
  tab (counts stay in sync).
- `support:update` — support chat changes, to the ticket owner (user or guest cookie) and admins.

Clients reload the data over the REST API, which checks permissions. The website reconnects after
sign-in, sign-out and session refresh. In production Caddy routes `/api/v1/ws/*` to the API.

## Re-registration warning

Every link of a social account to a profile is kept in `SocialAccountLink` (also after the account or user is
deleted). If an account shows up on a different user than before, admins get a notification and a
**Possible re-registration** warning (Accounts → Re-registration tab, Verifications, Users) with the full history;
the blogger keeps working until the admin chooses **Allow**, **Reject account** or **Block user**.

## Admin access

There is no public admin sign-up. The admin account comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`:

```bash
pnpm admin:create     # creates the admin, or resets its password; touches no other data (safe in production)
```

Then log in at `/login` with those credentials; admins land on **Overview** (sign-ups, briefs, applications,
the shortlist → accept funnel, bloggers on free trial vs paid, over 30 days / 90 days / 12 months), then
**Verifications** (approve / reject bloggers),
with **Brief review**, **Briefs**, **Users** (block, confirm email, send reset link, sign out everywhere) and
**Payments** in the sidebar.

Every brief is checked before bloggers see it: Publish puts it **In review**; the admin approves it (it goes live)
or sends it back with a reason (**Needs changes**). Resuming a paused brief skips review unless its title,
description, image, content formats or payment changed since the last approval. `pnpm db:seed` also creates the
admin, but it wipes the database — dev only. In production use a strong `ADMIN_PASSWORD` (the command refuses
the default one).

## Test

```bash
pnpm lint && pnpm typecheck
pnpm test                       # shared unit tests, UI tests, i18n key parity, API e2e (uses briefluence_test DB)
pnpm e2e                        # Playwright: sign-up → verify → apply → accept, and trial → pay → renew
```

Dev-only admin endpoints help test time-based flows: `POST /api/v1/admin/dev/advance-time {days}`,
`POST /api/v1/admin/dev/reset-time`, `POST /api/v1/admin/jobs/{expire-deals|billing-daily|social-sync|digests}/run`.

## Deploy for free on Oracle Cloud

One free ARM server runs Postgres, the API, the website and HTTPS: see [docs/oracle-deploy.md](docs/oracle-deploy.md)
(files in `deploy/oracle/`). The Render Blueprint (`render.yaml`) stays available as a paid alternative.

## Going live — checklist

- Real OAuth apps: Meta (Instagram API with Instagram Login, `instagram_business_basic` + `instagram_business_manage_insights`),
  TikTok Login Kit + Display API, Google (YouTube Data + Analytics, sensitive scopes). Redirect URI:
  `{WEB_URL}/api/v1/social/{instagram|tiktok|youtube}/callback`. Submit each for app review; set `SOCIAL_MOCK=false`.
- Ameriabank vPOS: request API credentials and **binding payments** (director applies in internet banking); confirm
  whether USD is allowed (otherwise `SUBSCRIPTION_CURRENCY=AMD`, `SUBSCRIPTION_PRICE_MINOR=390000`), the test OrderID
  range (`AMERIA_ORDER_ID_OFFSET`) and the binding `PaymentType`.
- Have a lawyer review the draft Terms and Privacy pages (all three languages).
- Deploy: web on Vercel (`API_INTERNAL_URL` → API), API + worker + Postgres + Redis on a VPS/Railway; `COOKIE_SECURE=true`.
