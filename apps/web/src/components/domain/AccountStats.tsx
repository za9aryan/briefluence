'use client';
import {
  Badge,
  Flag,
  Icon,
  IconBubble,
  Inline,
  ShareRow,
  SplitBar,
  Stack,
  Text,
  type IconName,
} from '@briefluence/ui';
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
  // Long usernames wrap (anywhere) instead of pushing past the card on phones.
  const handle = (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-bold text-ink">
      <Icon name={PLATFORM_ICON[account.platform]} />
      <span className="min-w-0 wrap-anywhere">@{account.username}</span>
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
          className="min-w-0 max-w-full hover:underline"
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
      {account.reviewStatus === 'PENDING' && (
        <Badge tone="neutral" icon="clock">
          {t('review.pending')}
        </Badge>
      )}
      {account.reviewStatus === 'REJECTED' && (
        <Badge tone="danger" icon="x-circle">
          {t('review.rejected')}
        </Badge>
      )}
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

/** Age buckets in their natural order ("13-17", "18-24", … "65+"). */
const ageStart = (k: string) => Number.parseInt(k, 10) || 0;

/**
 * Followers, engagement, views and posts as tiles with icons; the audience as a women / men split,
 * the top 3 age groups and top countries with flags. Every bar's value is written out.
 */
export function AccountStats({ account }: { account: SocialAccountDto }) {
  const t = useTranslations('verification');
  const f = useFormat();
  const o = useOptions();
  const g = account.audienceGender;
  const countries = account.audienceCountries
    ? Object.entries(account.audienceCountries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];
  const ages = account.audienceAge
    ? // The 3 biggest age groups, shown youngest first.
      Object.entries(account.audienceAge)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .sort((a, b) => ageStart(a[0]) - ageStart(b[0]))
    : [];
  const topAge = Math.max(0, ...ages.map(([, v]) => v));
  const topCountry = countries[0]?.[1] ?? 0;

  // Tiles are at least as wide as their label, so long words (ru/hy) never split; they wrap to
  // the next row on narrow screens instead.
  const stat = (icon: IconName, label: string, value: string) => (
    <div className="flex min-w-fit flex-1 items-center gap-2 rounded-sm bg-surface p-2 pr-3">
      <IconBubble name={icon} size="sm" tone="primary" />
      <div>
        <p className="text-small text-ink-muted">{label}</p>
        <p className="text-body font-bold text-ink tabular-nums">{value}</p>
      </div>
    </div>
  );
  const heading = (icon: IconName, text: string) => (
    <p className="flex items-center gap-1.5 text-small font-bold text-ink">
      <Icon name={icon} size="xs" /> {text}
    </p>
  );

  return (
    <Stack gap={4}>
      <div className="flex flex-wrap gap-2">
        {stat('users', t('followers'), f.compact(account.followers))}
        {stat(
          'heart',
          t('engagement'),
          account.engagementRate != null ? f.percent(account.engagementRate) : '—',
        )}
        {stat('eye', t('avgViews'), account.avgViews != null ? f.compact(account.avgViews) : '—')}
        {account.mediaCount != null && stat('image', t('posts'), f.compact(account.mediaCount))}
      </div>
      {g || countries.length || ages.length ? (
        <Stack gap={4}>
          {g && (
            <SplitBar
              label={t('audienceGender')}
              left={{
                icon: 'female',
                label: t('women'),
                percent: g.female ?? 0,
                value: f.percent(g.female ?? 0),
              }}
              right={{
                icon: 'male',
                label: t('men'),
                percent: g.male ?? 0,
                value: f.percent(g.male ?? 0),
              }}
            />
          )}
          {(ages.length > 0 || countries.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {ages.length > 0 && (
                <Stack gap={2}>
                  {heading('cake', t('topAges'))}
                  {ages.map(([k, v]) => (
                    <ShareRow
                      key={k}
                      label={k.replace('-', '–')}
                      percent={(v / (topAge || 1)) * 100}
                      value={f.percent(v)}
                      strong={v === topAge}
                    />
                  ))}
                </Stack>
              )}
              {countries.length > 0 && (
                <Stack gap={2}>
                  {heading('globe', t('topCountries'))}
                  {countries.map(([k, v]) => (
                    <ShareRow
                      key={k}
                      leading={/^[A-Z]{2}$/i.test(k) ? <Flag code={k} /> : undefined}
                      label={o.country(k)}
                      percent={(v / (topCountry || 1)) * 100}
                      value={f.percent(v)}
                      strong={v === topCountry}
                    />
                  ))}
                </Stack>
              )}
            </div>
          )}
        </Stack>
      ) : (
        <Text size="small" tone="muted">
          {account.source === 'MANUAL' ? t('manual.noAudience') : t('noDemographics')}
        </Text>
      )}
    </Stack>
  );
}
