'use client';
import {
  Badge,
  Flag,
  PLATFORM_GLOW,
  PlatformLogo,
  cn,
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
import type { GuestAccountDto, SocialAccountDto } from '@/lib/types';
import type { CSSProperties } from 'react';
import css from './AccountBanner.module.css';

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

/**
 * Header of a social account on a profile: the platform's logo in its colors, a large @username,
 * followers and engagement as big numbers (when the viewer may see them) and an "Open profile"
 * button, on a soft glow in the platform's color.
 */
export function AccountBanner({ account }: { account: SocialAccountDto | GuestAccountDto }) {
  const t = useTranslations('verification');
  const th = useTranslations('portfolio.view.hero');
  const tp = useTranslations('enums.platform');
  const f = useFormat();
  const full = 'followers' in account ? account : null;
  return (
    <div
      className={cn(css.banner, '@container rounded-card p-4')}
      style={{ '--glow': PLATFORM_GLOW[account.platform] } as CSSProperties}
    >
      <div className="flex items-center gap-4 pr-12">
        <PlatformLogo platform={account.platform} label={tp(account.platform)} />
        <div className="min-w-0 flex-1">
          <p className="text-small text-ink-muted">{tp(account.platform)}</p>
          <p className="text-h2 font-extrabold text-ink wrap-anywhere">@{account.username}</p>
        </div>
      </div>
      <a
        href={account.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={th('open')}
        title={th('open')}
        className={css.open}
      >
        <Icon name="external" size="sm" />
      </a>
      {full && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 @lg:grid-cols-4">
            {(
              [
                [th('followers'), f.compact(full.followers)],
                [
                  th('engagement'),
                  full.engagementRate != null ? f.percent(full.engagementRate) : '—',
                ],
                [t('avgViews'), full.avgViews != null ? f.compact(full.avgViews) : '—'],
                [t('posts'), full.mediaCount != null ? f.compact(full.mediaCount) : '—'],
              ] as const
            ).map(([label, value]) => (
              <span key={label} className="flex min-w-0 flex-col">
                <span className="truncate text-label uppercase text-ink-muted">{label}</span>
                <span className="text-h2 font-extrabold tabular-nums text-ink">{value}</span>
              </span>
            ))}
          </div>
          <span className="flex flex-wrap gap-2 empty:hidden">
            {full.reviewStatus === 'PENDING' && (
              <Badge tone="neutral" icon="clock">
                {t('review.pending')}
              </Badge>
            )}
            {full.reviewStatus === 'REJECTED' && (
              <Badge tone="danger" icon="x-circle">
                {t('review.rejected')}
              </Badge>
            )}
            {full.source === 'MANUAL' && (
              <Badge tone="neutral" icon="edit">
                {t('manual.badge')}
              </Badge>
            )}
            {full.needsReconnect && (
              <Badge tone="danger" icon="warning">
                {t('needsReconnect')}
              </Badge>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/** Age buckets in their natural order ("13-17", "18-24", … "65+"). */
const ageStart = (k: string) => Number.parseInt(k, 10) || 0;

/**
 * Followers, engagement, views and posts as tiles with icons; the audience as a women / men split,
 * the top 3 age groups and top countries with flags. Every bar's value is written out.
 */
export function AccountStats({
  account,
  audienceOnly,
}: {
  account: SocialAccountDto;
  /** Skip the number tiles (an AccountBanner above already shows them). */
  audienceOnly?: boolean;
}) {
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
      {!audienceOnly && (
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
      )}
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
