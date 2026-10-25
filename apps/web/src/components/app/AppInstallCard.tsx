'use client';
import {
  Button,
  Card,
  CardHeader,
  Icon,
  Inline,
  Stack,
  Switch,
  Text,
  useToast,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useInstall, usePush, type PushState } from '@/lib/pwa';

const PUSH_NOTE: Record<Exclude<PushState, 'loading'>, string> = {
  off: 'off',
  on: 'on',
  'needs-install': 'needsInstall',
  denied: 'denied',
  unsupported: 'unsupported',
  unavailable: 'unavailable',
};

/** Settings: install briefluence as an app (per-device steps) and push on this device. */
export function AppInstallCard() {
  const t = useTranslations('pwa');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { state: install, prompt } = useInstall();
  const push = usePush();

  // The toast reports what actually happened (the user may block the permission dialog).
  const onSwitch = async (on: boolean) => {
    try {
      if (on) {
        if ((await push.enable()) === 'on') toast(t('push.enabledToast'));
      } else {
        await push.disable();
        toast(t('push.disabledToast'), 'info');
      }
    } catch (e) {
      toast(errorMessage(e), 'danger');
    }
  };

  // Phones and tablets only: that's where installing and push matter.
  if (!install || install.platform === 'desktop') return null;
  return (
    <Card id="app" className="scroll-mt-24">
      <CardHeader title={t('title')} description={t('lead')} />
      <Stack gap={6}>
        <Stack gap={2}>
          <Text weight="bold">{t('install.title')}</Text>
          {!install ? null : install.installed ? (
            <Inline gap={2}>
              <Icon name="check-circle" tone="success" />
              <Text size="small">{t('install.installed')}</Text>
            </Inline>
          ) : install.canPrompt ? (
            <Button icon="plus" className="self-start" onClick={() => void prompt()}>
              {t('install.button')}
            </Button>
          ) : install.platform === 'ios' ? (
            <Steps
              items={[
                t('install.ios.s1'),
                t('install.ios.s2'),
                t('install.ios.s3'),
                t('install.ios.s4'),
              ]}
            />
          ) : install.platform === 'android' ? (
            <Steps items={[t('install.android.s1'), t('install.android.s2')]} />
          ) : (
            <Text size="small" tone="muted">
              {t('install.desktop')}
            </Text>
          )}
        </Stack>

        <Switch
          checked={push.state === 'on'}
          disabled={push.busy || !['on', 'off'].includes(push.state)}
          onChange={(on) => void onSwitch(on)}
          label={t('push.label')}
          description={push.state === 'loading' ? undefined : t(`push.${PUSH_NOTE[push.state]}`)}
        />
      </Stack>
    </Card>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((s, i) => (
        <li key={s} className="flex items-start gap-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-pill bg-primary-soft text-label font-bold text-primary-text">
            {i + 1}
          </span>
          <Text size="small">{s}</Text>
        </li>
      ))}
    </ol>
  );
}
