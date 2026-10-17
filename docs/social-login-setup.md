# Sign in with Google / Apple — setup

The "Continue with Google" and "Continue with Apple" buttons work in two modes:

- **Simulated** (`OAUTH_LOGIN_MOCK=true`, the default locally and on Render until keys are in):
  the button opens a test page where you type any email and name. Nothing leaves the app.
- **Real**: remove the provider from `OAUTH_LOGIN_MOCK` (e.g. `OAUTH_LOGIN_MOCK=apple` keeps only
  Apple simulated, `OAUTH_LOGIN_MOCK=` turns both real) and fill in its keys below.
  A provider without keys and not simulated simply has no button.

The callback address is always `<WEB_URL>/api/v1/auth/oauth/<provider>/callback`, for example
`https://briefluence.am/api/v1/auth/oauth/google/callback`.

How accounts are matched: the first sign-in with a provider links it to an existing account with
the same **verified** email. Someone new is asked "Brand or Blogger?" and to accept the terms, then
the account is created with the email already confirmed. They can add a password later in
Settings → Set a password.

## Google

You can reuse the same Google Cloud project as the YouTube connection (`GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` are shared).

1. Open https://console.cloud.google.com → pick the project → **APIs & Services → OAuth consent screen**.
   App name `briefluence`, support email, logo, links to `/privacy` and `/terms`, authorized domain
   `briefluence.am`. Scopes: `openid`, `email`, `profile` (no review needed for these).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `https://briefluence.am` (and `http://localhost:3000` for local)
   - Authorized redirect URIs: `https://briefluence.am/api/v1/auth/oauth/google/callback`
     (and `http://localhost:3000/api/v1/auth/oauth/google/callback`)
     If you already have a client for YouTube, just add these URIs to it.
3. Put the Client ID / secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. On the consent screen press **Publish app** — while it is in "Testing" only listed test users can sign in.

## Apple

Needs a paid Apple Developer account (99 USD/year). Apple does **not** accept `localhost` or plain
`http` addresses, so test real Apple sign-in on the deployed site.

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles → Identifiers**.
2. Create an **App ID** (e.g. `am.briefluence.app`) with **Sign in with Apple** ticked.
3. Create a **Services ID** (e.g. `am.briefluence.web`) — this is `APPLE_CLIENT_ID`.
   Tick Sign in with Apple → Configure → primary App ID from step 2,
   domain `briefluence.am`, return URL `https://briefluence.am/api/v1/auth/oauth/apple/callback`.
4. **Keys → +** → tick Sign in with Apple → configure with the App ID → download the `.p8` file
   (only downloadable once). The Key ID shown is `APPLE_KEY_ID`.
5. Your Team ID (top right of the developer portal) is `APPLE_TEAM_ID`.
6. `APPLE_PRIVATE_KEY` is the content of the `.p8` file. In `.env` put it on one line with `\n`
   for line breaks; in Render you can paste it as is.

Note: Apple shares the person's name only the very first time they sign in, and may give a
private relay email (`…@privaterelay.appleid.com`). To email those addresses, register your
sending domain under **Services → Sign in with Apple for Email Communication**.

## Turning it on

After adding keys, set `OAUTH_LOGIN_MOCK` accordingly and restart the API (on Render: save the
environment group; the API and worker redeploy). The buttons appear by themselves.
