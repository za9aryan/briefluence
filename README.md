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

## Admin access

There is no public admin sign-up. The admin account comes from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`:

```bash
pnpm admin:create     # creates the admin, or resets its password; touches no other data (safe in production)
```

Then log in at `/login` with those credentials; admins land on **Verifications** (approve / reject bloggers),
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

## Going live — checklist

- Real OAuth apps: Meta (Instagram API with Instagram Login, `instagram_business_basic` + `instagram_business_manage_insights`),
  TikTok Login Kit + Display API, Google (YouTube Data + Analytics, sensitive scopes). Redirect URI:
  `{WEB_URL}/api/v1/social/{instagram|tiktok|youtube}/callback`. Submit each for app review; set `SOCIAL_MOCK=false`.
- Ameriabank vPOS: request API credentials and **binding payments** (director applies in internet banking); confirm
  whether USD is allowed (otherwise `SUBSCRIPTION_CURRENCY=AMD`, `SUBSCRIPTION_PRICE_MINOR=390000`), the test OrderID
  range (`AMERIA_ORDER_ID_OFFSET`) and the binding `PaymentType`.
- Have a lawyer review the draft Terms and Privacy pages (all three languages).
- Deploy: web on Vercel (`API_INTERNAL_URL` → API), API + worker + Postgres + Redis on a VPS/Railway; `COOKIE_SECURE=true`.
