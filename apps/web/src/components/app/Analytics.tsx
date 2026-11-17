'use client';
import { Button, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  CONSENT_EVENT,
  type AnalyticsConsent,
  loadGoogleAnalytics,
  readConsent,
  revokeGoogleAnalytics,
  saveConsent,
  sendPageView,
} from '@/lib/analytics';

/**
 * Google Analytics behind a cookie banner. Nothing loads until the visitor taps "Allow"; the
 * choice is remembered on this device and can be changed from "Cookie settings" in the footer.
 * Without a measurement ID (local dev, tests) this renders nothing.
 */
export function Analytics({ measurementId }: { measurementId?: string }) {
  const [consent, setConsent] = useState<AnalyticsConsent | null | undefined>(undefined);

  useEffect(() => {
    if (!measurementId) return;
    setConsent(readConsent());
    const reopen = () => setConsent(null);
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_EVENT, reopen);
  }, [measurementId]);

  useEffect(() => {
    if (measurementId && consent === 'granted') loadGoogleAnalytics(measurementId);
  }, [measurementId, consent]);

  if (!measurementId) return null;
  const choose = (v: AnalyticsConsent) => {
    saveConsent(v);
    if (v === 'denied') revokeGoogleAnalytics();
    setConsent(v);
  };

  return (
    <>
      {consent === 'granted' && (
        // useSearchParams needs a Suspense boundary in the App Router.
        <Suspense fallback={null}>
          <PageViews />
        </Suspense>
      )}
      {consent === null && <ConsentBanner onChoose={choose} />}
    </>
  );
}

/** One page_view per route (path or query change), sent after the new page has its title. */
function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const id = window.setTimeout(sendPageView, 0);
    return () => window.clearTimeout(id);
  }, [pathname, search]);
  return null;
}

function ConsentBanner({ onChoose }: { onChoose: (v: AnalyticsConsent) => void }) {
  const t = useTranslations('legal.cookies');
  return (
    <section
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-4 z-50 rounded-card border border-line bg-surface-raised p-4 shadow-pop sm:right-auto sm:max-w-md md:p-5"
    >
      <Stack gap={2}>
        <Text size="small" weight="bold">
          {t('title')}
        </Text>
        <Text size="small" tone="muted">
          {t.rich('body', {
            link: (chunks) => (
              <Link href="/privacy" className="font-bold text-primary-text underline">
                {chunks}
              </Link>
            ),
          })}
        </Text>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onChoose('granted')}>
            {t('allow')}
          </Button>
          <Button size="sm" variant="neutral" onClick={() => onChoose('denied')}>
            {t('deny')}
          </Button>
        </div>
      </Stack>
    </section>
  );
}

/** Footer link that shows the cookie banner again. */
export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations('legal.cookies');
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        saveConsent(null);
        window.dispatchEvent(new Event(CONSENT_EVENT));
      }}
    >
      {t('settings')}
    </button>
  );
}
