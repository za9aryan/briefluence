# Connecting real Instagram, TikTok and YouTube accounts

Locally, `SOCIAL_MOCK=true` simulates the "Connect" button. To use the real login for a platform you
need a developer app on that platform, its keys in `.env`, and the platform removed from `SOCIAL_MOCK`.

You can switch one platform at a time, e.g. `SOCIAL_MOCK=tiktok,youtube` = real Instagram, the rest
simulated. The API refuses to start if a platform is real but its keys are missing.

## 0. A public HTTPS address (Instagram and TikTok need it)

Instagram and TikTok only redirect back to **HTTPS** addresses that you register in their dashboards,
so `http://localhost:3000` does not work for them (Google accepts localhost).

- In production: your real domain, e.g. `https://briefluence.am`.
- For local testing: a tunnel, e.g. `cloudflared tunnel --url http://localhost:3000` (free, no account)
  or `ngrok http 3000`. It prints an address like `https://random-words.trycloudflare.com`.

Then in `.env`:

```
WEB_URL=https://random-words.trycloudflare.com
CORS_ORIGINS=https://random-words.trycloudflare.com
COOKIE_SECURE=true
```

and open the app through that address (not localhost). Restart the API after changing `.env`.
Free tunnel addresses change on every start, so you must update `.env` and the redirect URIs below
each time — a fixed domain (named Cloudflare tunnel or paid ngrok) avoids that.

The redirect (callback) URI to register on each platform is:

```
{WEB_URL}/api/v1/social/instagram/callback
{WEB_URL}/api/v1/social/tiktok/callback
{WEB_URL}/api/v1/social/youtube/callback
```

## 1. Instagram (Meta)

Works only with Instagram **Business** or **Creator** accounts (free switch in Instagram settings).

1. Go to https://developers.facebook.com → **My Apps → Create app** → use case allowing the Instagram API → type **Business**.
2. In the app, add the **Instagram** product and open **API setup with Instagram login**.
3. Copy the **Instagram app ID** and **Instagram app secret** (these differ from the Facebook app ID) into
   `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.
4. Under **Set up Instagram business login → Business login settings**, add the Instagram redirect URI above.
5. While the app is in development mode only invited testers can connect: **App roles → Roles → Add
   Instagram testers**, then the tester accepts in Instagram (**Settings → Apps and websites → Tester invites**).
6. Permissions used: `instagram_business_basic` and `instagram_business_manage_insights` (audience
   demographics; only returned for accounts with 100+ followers).
7. To go live for everyone: complete **Business verification** and submit **App Review** for both
   permissions, with a screencast of the connect flow and the privacy policy URL `{WEB_URL}/privacy`.

Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login

## 2. TikTok

1. Go to https://developers.tiktok.com → **Manage apps → Connect an app**.
2. Fill in the app details, including terms `{WEB_URL}/terms` and privacy `{WEB_URL}/privacy`.
3. Add products **Login Kit** and the scopes `user.info.basic`, `user.info.profile`, `user.info.stats`,
   `video.list`.
4. In Login Kit settings, add the TikTok redirect URI above (Web).
5. Copy **Client key** and **Client secret** into `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
6. Before approval, use **Sandbox** and add your TikTok accounts as target users.
7. Submit the app for review to go live.

TikTok does not provide audience demographics; those match factors get half points.
Docs: https://developers.tiktok.com/doc/login-kit-web

## 3. YouTube (Google)

1. Go to https://console.cloud.google.com → create a project.
2. **APIs & Services → Library**: enable **YouTube Data API v3** and **YouTube Analytics API**.
3. **OAuth consent screen**: type **External**, add scopes `youtube.readonly` and
   `yt-analytics.readonly`, add your Google accounts as **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Web application**; add the YouTube redirect
   URI above (here `http://localhost:3000/api/v1/social/youtube/callback` also works).
5. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. These are sensitive scopes: to go beyond test users, submit the app for **Google OAuth verification**.

Docs: https://developers.google.com/identity/protocols/oauth2/web-server

## 4. Switch it on

```
SOCIAL_MOCK=false          # or e.g. tiktok,youtube to keep those simulated
```

Restart the API. Its log prints which platforms are real, e.g.
`Social OAuth: real=[INSTAGRAM] mock=[TIKTOK, YOUTUBE]`.

Dashboard wording changes often; if a menu name above differs, follow the linked official docs.
