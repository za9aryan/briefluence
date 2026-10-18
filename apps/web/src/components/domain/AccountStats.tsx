'use client';
import { Badge, Icon, Inline, Progress, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON, useOptions } from '@/lib/hooks/options';
import type { SocialAccountDto } from '@/lib/types';

/** One-line summary: platform, @username, followers, ER. */
export function AccountLine({
  account,
  link = true,
}: {
  account: SocialAccountDto;
  link?: boolean;
}) {
  const t = useTranslations('verification');
  const f = useFormat();
  const handle = (
    <span className="inline-flex items-center gap-1 font-bold text-ink">
      <Icon name={PLATFORM_ICON[account.platform]} />@{account.username}
      {link && <Icon name="external" size="xs" tone="muted" />}
    </span>
  );
  return (
    <Inline gap={2} wrap>
      {link ? (
        <a
          href={account.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {handle}
        </a>
      ) : (
        handle
      )}
      <Text as="span" size="small" tone="muted">
        {t('followersShort', { count: f.compact(account.followers) })}
        {account.engagementRate != null && ` · ER ${f.percent(account.engagementRate)}`}
      </Text>
      {account.source === 'MANUAL' && (
        <Badge tone="neutral" icon="edit">
          {t('manual.badge')}
        </Badge>
      )}
      {account.needsReconnect && (
        <Badge tone="danger" icon="warning">
          {t('needsReconnect')}
        </Badge>
      )}
    </Inline>
  );
}

/** Followers, engagement, average views and audience split. */
export function AccountStats({ account }: { account: SocialAccountDto }) {
  const t = useTranslations('verification');
  const f = useFormat();
  const o = useOptions();
  const g = account.audienceGender;
  const topCountries = account.audienceCountries
    ? Object.entries(account.audienceCountries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];
  const ages = account.audienceAge
    ? Object.entries(account.audienceAge)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  const stat = (label: string, value: string) => (
    <div className="min-w-0 rounded-sm bg-surface p-2">
      <p className="text-small text-ink-muted">{label}</p>
      <p className="text-body font-bold text-ink tabular-nums">{value}</p>
    </div>
  );

  return (
    <Stack gap={4}>
      <div className="grid grid-cols-3 gap-2">
        {stat(t('followers'), f.compact(account.followers))}
        {stat(
          t('engagement'),
          account.engagementRate != null ? f.percent(account.engagementRate) : '—',
        )}
        {stat(t('avgViews'), account.avgViews != null ? f.compact(account.avgViews) : '—')}
      </div>
      {g || topCountries.length || ages.length ? (
        <Stack gap={2}>
          {g && (
            <div>
              <Inline justify="between">
                <Text size="small" tone="muted">
                  {t('audienceFemale', { value: f.percent(g.female ?? 0) })}
                </Text>
                <Text size="small" tone="muted">
                  {t('audienceMale', { value: f.percent(g.male ?? 0) })}
                </Text>
              </Inline>
              <Progress value={g.female ?? 0} label={t('audienceGender')} className="mt-1" />
            </div>
          )}
          {ages.length > 0 && (
            <Text size="small" tone="muted">
              {t('topAges')}: {ages.map(([k, v]) => `${k} (${f.percent(v)})`).join(', ')}
            </Text>
          )}
          {topCountries.length > 0 && (
            <Text size="small" tone="muted">
              {t('topCountries')}:{' '}
              {topCountries.map(([k, v]) => `${o.country(k)} (${f.percent(v)})`).join(', ')}
            </Text>
          )}
        </Stack>
      ) : (
        <Text size="small" tone="muted">
          {t('noDemographics')}
        </Text>
      )}
    </Stack>
  );
}
