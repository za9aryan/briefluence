import { TIMEZONE } from '@briefluence/shared';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from './config';
import { NAMESPACES } from './namespaces';

async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries);
}

/** Locale comes from the user's choice (cookie), else the browser's Accept-Language. */
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : negotiateLocale((await headers()).get('accept-language'));
  return { locale, timeZone: TIMEZONE, messages: await loadMessages(locale) };
});
