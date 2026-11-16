# Sign in with Google — setup

The "Continue with Google" button works in two modes:

- **Simulated** (`OAUTH_LOGIN_MOCK=true`, local development and tests only): the button opens a
  test page where you type any email and name. It never signs in to an existing account, and the
  API refuses to start with it in production (even with `ALLOW_MOCKS_IN_PRODUCTION`).
- **Real** (`OAUTH_LOGIN_MOCK=false` plus `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
  Without keys and without the simulation there is simply no button.

The callback address is `<WEB_URL>/api/v1/auth/oauth/google/callback`, in production
`https://briefluence.com/api/v1/auth/oauth/google/callback`.

How accounts are matched: the first Google sign-in links to an existing account with the same
**verified** email. Someone new is asked "Company or Influencer?" and to accept the terms, then the
account is created with the email already confirmed. They can add a password later in Settings.

## Google Cloud (Google Auth Platform)

Docs: https://support.google.com/cloud/answer/15549257 (creating the client). The same project and
keys later serve the YouTube connection (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are shared).

1. https://console.cloud.google.com → create a project `briefluence`.
2. **Google Auth Platform → Branding**: app name `briefluence`, user support email, home page
   `https://briefluence.com`, privacy policy `https://briefluence.com/privacy`, terms
   `https://briefluence.com/terms`, authorized domain `briefluence.com`, developer contact email.
3. **Audience**: user type **External**.
4. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `https://briefluence.com` (and `http://localhost:3000` for local)
   - Authorized redirect URIs: `https://briefluence.com/api/v1/auth/oauth/google/callback`
     (and `http://localhost:3000/api/v1/auth/oauth/google/callback`)
   - Copy the client secret right away: it is shown in full only once.
5. Put them into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and set `OAUTH_LOGIN_MOCK=false`.
6. **Audience → Publish app**. While the app is in "Testing", only the listed test users can sign in.
