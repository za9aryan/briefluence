# Website statistics (Google Analytics 4)

The admin **Statistics** page (`/admin/statistics`) shows who visits briefluence.com, where they
come from and how many sign up. Visits come from Google Analytics 4; sign-ups come from our own
database.

## How it works

- **Website.** When `GA_MEASUREMENT_ID` is set, visitors see a small cookie banner. Google's tag
  (gtag.js) loads only after they tap **Allow**. Before that, nothing is sent to Google. "Cookie
  settings" in the footer reopens the banner. The code is in `apps/web/src/lib/analytics.ts` and
  `apps/web/src/components/app/Analytics.tsx`.
- **Page views** are sent by our code with a cleaned URL. Only `utm_*` and `ref` are kept, so
  private links (password reset, email confirmation, sign-up tokens) never reach Google. Admin
  pages are not tracked. Ad signals are always denied, because we run no ads.
- **Reports.** The API reads the
  [Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) with a service
  account (`apps/api/src/modules/admin/traffic.service.ts`). The normal reports are cached for
  10 minutes and the realtime report for 30 seconds.
- Without the `GA_*` settings, the banner does not appear and the Statistics page explains how to
  connect Google Analytics.

## Setup (once)

1. **Create the property.** At [analytics.google.com](https://analytics.google.com), go to
   Admin › Create › Property and name it `briefluence`.
   - Set **Reporting time zone** to Armenia (GMT+04:00), so days and hours match Yerevan.
   - Set **Currency** to USD.
2. **Add the web stream.** Go to Admin › Data streams › Add stream › Web and enter
   `https://briefluence.com`. Copy the **Measurement ID** (`G-…`).
3. **Avoid double page views.** In the stream, open **Enhanced measurement** ⚙ › Page views ›
   Show advanced settings and turn **off** "Page changes based on browser history events". Our
   code sends page views itself.
4. **Find the property ID.** Go to Admin › Property details and copy the numeric **Property ID**.
5. **Create the service account.** In [Google Cloud Console](https://console.cloud.google.com), you
   can use the same project as Google sign-in.
   - APIs & Services › Library: enable **Google Analytics Data API**.
   - IAM & Admin › Service accounts › Create service account: name it `briefluence-analytics` and
     give it no roles.
   - Open it › Keys › Add key › JSON. A file downloads; keep it private.
6. **Give the service account access.** In Google Analytics, go to Admin › Property access
   management › + › Add users. Paste the service account's email (`…@….iam.gserviceaccount.com`)
   and choose the **Viewer** role.
7. **Fill in the server `.env`** in `~/briefluence/deploy/oracle/.env`. Back it up first:
   `cp .env .env.bak-$(date +%F)`.

   ```
   GA_MEASUREMENT_ID=G-XXXXXXXXXX
   GA_PROPERTY_ID=123456789
   GA_CLIENT_EMAIL=briefluence-analytics@your-project.iam.gserviceaccount.com
   GA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE…\n-----END PRIVATE KEY-----\n"
   ```

   - `GA_PRIVATE_KEY` is the `private_key` value from the JSON file, kept on one line with its
     `\n` escapes.
   - Then run `./deploy/oracle/deploy.sh`.

**Optional settings in Google Analytics:**

- Admin › Data collection and modification › Data retention › **14 months**.
- Admin › Data streams › the stream › Configure tag settings › Define internal traffic, to leave
  out the team's own visits.

## What the page shows

- **Right now.** People on the site in the last 30 minutes, visitors per minute, and the open
  pages, countries and devices. It refreshes every 30 seconds.
- **For 7, 30 or 90 days**, each compared with the period before:
  - **Totals:** visitors, new visitors, visits, page views, average visit length, engaged visits,
    sign-ups, and visitor → sign-up conversion (sign-ups per 100 new visitors).
  - **Over time:** visitors per day and sign-ups per day.
  - **Where visitors come from:** channels (search, social, direct, links) and top sources.
  - **Who the visitors are:** countries, cities, devices, new vs returning visitors, browser
    languages, browsers and systems.
  - **When they visit:** busiest hours and days of the week.
  - **Pages:** the most viewed pages, and entry pages with their engagement rate.

Google's numbers can lag a few hours behind. Visitors who don't allow cookies are not counted, so
visits are lower than the real number. Sign-ups always come from our database, so they are exact.
