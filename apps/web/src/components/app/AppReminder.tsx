'use client';
import type { Role } from '@briefluence/shared';
import { Alert, Button, Icon, Inline, buttonStyles, useToast } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useInstall, usePush } from '@/lib/pwa';

const HIDE_KEY = 'bf:app-reminder-hidden-until';
const HIDE_DAYS = 14;

/**
 * Top-of-page reminder on phones and tablets (like the verify-email banner): add briefluence to
 * the Home Screen (iPhone needs that for push) or turn push on. Hidden on desktop, for admins,
 * once done, or for 14 days after ✕ on this device.
 */
export function AppReminder({ role }: { role: Role }) {
  const t = useTranslations('pwa.banner');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { state: install, prompt } = useInstall();
  const push = usePush();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      setHidden(Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now());
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden || !install || install.platform === 'desktop' || role === 'ADMIN') return null;
  const settings = `/${role === 'BRAND' ? 'brand' : 'influencer'}/settings#app`;
  const kind =
    install.platform === 'ios' && !install.installed
      ? 'install-ios'
      : push.state === 'off'
        ? 'push'
        : !install.installed && install.canPrompt
          ? 'install-prompt'
          : null;
  if (!kind) return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      // Private mode: hide for this visit only.
    }
    setHidden(true);
  };
  const turnOn = async () => {
    try {
      await push.enable();
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };

  return (
    <Alert
      tone="brand"
      action={
        <Inline gap={1}>
          {kind === 'push' ? (
            <Button size="sm" loading={push.busy} onClick={() => void turnOn()}>
              {t('turnOn')}
            </Button>
          ) : kind === 'install-prompt' ? (
            <Button size="sm" onClick={() => void prompt()}>
              {t('installButton')}
            </Button>
          ) : (
            <Link href={settings} className={buttonStyles({ size: 'sm' })}>
              {t('howTo')}
            </Link>
          )}
          <Button variant="ghost" size="icon" aria-label={t('dismiss')} onClick={hide}>
            <Icon name="close" />
          </Button>
        </Inline>
      }
    >
      {kind === 'push' ? t('push') : t('install')}
    </Alert>
  );
}
