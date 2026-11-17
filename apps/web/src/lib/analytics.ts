/**
 * Google Analytics 4 (gtag.js) with Consent Mode
 * (https://developers.google.com/tag-platform/security/guides/consent). The tag loads only after
 * the visitor agrees in the cookie banner; until then nothing is sent to Google. Page views are
 * sent by us (https://developers.google.com/analytics/devguides/collection/ga4/views) with a
 * cleaned URL, so private links (email confirmation, password reset, sign-up tokens) never reach
 * Google. In the GA web stream, turn off Enhanced measurement › "Page changes based on browser
 * history events", or page views are counted twice.
 */

export type AnalyticsConsent = 'granted' | 'denied';

const CONSENT_KEY = 'bf.analytics-consent';
/** Fired by "Cookie settings" in the footer to show the banner again. */
export const CONSENT_EVENT = 'bf:cookie-settings';

/** Query parameters that say where a visitor came from; everything else is dropped. */
const KEEP_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref'];

/** Pages whose views we don't send: the admin area and one-off links. */
const SKIP = [/^\/admin(\/|$)/, /^\/oauth(\/|$)/, /^\/billing\/mock-checkout/];

export const isMeasurementId = (v: string | undefined): v is string =>
  !!v && /^G-[A-Z0-9]+$/.test(v);

/** The page URL as sent to Google: origin + path + only the "where from" parameters. */
export function cleanPageLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  for (const k of KEEP_PARAMS) {
    const v = url.searchParams.get(k);
    if (v) kept.set(k, v.slice(0, 100));
  }
  const q = kept.toString();
  return `${url.origin}${url.pathname}${q ? `?${q}` : ''}`;
}

export const tracksPath = (pathname: string) => !SKIP.some((r) => r.test(pathname));

export function readConsent(): AnalyticsConsent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(v: AnalyticsConsent | null) {
  try {
    if (v) localStorage.setItem(CONSENT_KEY, v);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
}

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/**
 * Loads gtag.js once, after consent. Consent defaults go first, then config without the automatic
 * page view (we send our own). We run no ads, so the ad signals stay denied.
 */
export function loadGoogleAnalytics(measurementId: string) {
  // Already loaded on this page (consent was withdrawn, then given again).
  if (window.gtag) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js reads the `arguments` object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
}

/**
 * Visitor withdrew consent: stop analytics storage and remove the `_ga*` cookies GA set
 * (on the top-level domain by default).
 */
export function revokeGoogleAnalytics() {
  window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim();
    if (!name?.startsWith('_ga')) continue;
    document.cookie = `${name}=; ${expired}`;
    document.cookie = `${name}=; ${expired}; domain=.${location.hostname.replace(/^www\./, '')}`;
  }
}

export function sendPageView() {
  if (!window.gtag || !tracksPath(location.pathname)) return;
  window.gtag('event', 'page_view', {
    page_location: cleanPageLocation(location.href),
    page_title: document.title,
  });
}
