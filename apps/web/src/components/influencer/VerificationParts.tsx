'use client';
import { PLATFORMS, type Platform } from '@briefluence/shared';
import { Avatar, Badge, Icon, LogoMark, PLATFORM_GLOW, PlatformLogo, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { API_BASE } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import type { InfluencerProfileDto } from '@/lib/types';
import css from './Verification.module.css';

/**
 * "You are verified": a seal with a slow shine, the note, and a preview of how companies see the
 * influencer (name, Verified badge, each account and whether its stats are fresh).
 */
export function VerifiedPanel({ profile }: { profile: InfluencerProfileDto }) {
  const t = useTranslations('verification');
  const tv = useTranslations('enums.verificationStatus');
  const f = useFormat();
  return (
    <section
      role="status"
      className={cn(
        css.verified,
        'grid grid-cols-1 gap-6 rounded-card p-4 sm:p-6 lg:grid-cols-[1fr_minmax(0,22rem)] lg:items-center',
      )}
    >
      <div className="flex items-start gap-4">
        <span aria-hidden className={css.seal}>
          <Icon name="verified" size="md" />
        </span>
        <div className="min-w-0 pt-1">
          <p className="text-h2 font-extrabold text-ink">{t('approvedTitle')}</p>
          <p className="mt-1 text-small text-ink-muted">{t('approvedBody')}</p>
        </div>
      </div>

      <div className={cn(css.preview, 'rounded-card bg-surface-raised p-4')}>
        <p className="mb-2 text-label uppercase text-ink-muted">{t('hero.seen')}</p>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={profile.displayName} src={profile.avatarUrl} />
          <p className="min-w-0 truncate font-bold text-ink">{profile.displayName}</p>
          <Badge variant="small" tone="success" icon="verified" className="shrink-0">
            {tv('APPROVED')}
          </Badge>
        </div>
        {profile.socialAccounts.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {profile.socialAccounts.map((a) => (
              <li key={a.id} className="flex min-w-0 items-center gap-2 text-small">
                <Icon name={PLATFORM_ICON[a.platform]} size="xs" label={a.platform} />
                <span className="min-w-0 flex-1 truncate font-bold text-ink">@{a.username}</span>
                <span className="tabular-nums text-ink-muted">{f.compact(a.followers)}</span>
                {a.needsReconnect ? (
                  <Badge variant="small" tone="primary" icon="refresh">
                    {t('needsReconnect')}
                  </Badge>
                ) : (
                  <span className="inline-flex items-center gap-1 font-bold text-success">
                    <span className={css.live} />
                    {t('hero.fresh')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * The three platforms as tiles (official login, one per platform), with a small "orbit" art: the
 * platforms linked to briefluence, connected ones lit up.
 */
export function ConnectTiles({ used }: { used: Platform[] }) {
  const t = useTranslations('verification');
  const tp = useTranslations('enums.platform');
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
      {PLATFORMS.map((pl) => {
        const glow = { '--glow': PLATFORM_GLOW[pl] } as CSSProperties;
        // One account per platform: a platform already added shows as done.
        return used.includes(pl) ? (
          <div key={pl} style={glow} className={cn(css.tile, css.done, 'rounded-card p-4')}>
            <TileBody
              platform={pl}
              title={t('platformAdded', { platform: tp(pl) })}
              sub={t('hero.connected')}
              done
            />
          </div>
        ) : (
          <a
            key={pl}
            style={glow}
            href={`${API_BASE}/social/${pl.toLowerCase()}/connect`}
            className={cn(css.tile, css.open, 'rounded-card p-4')}
          >
            <TileBody
              platform={pl}
              title={t('connect', { platform: tp(pl) })}
              sub={t('hero.official')}
            />
          </a>
        );
      })}
    </div>
  );
}

function TileBody({
  platform,
  title,
  sub,
  done,
}: {
  platform: Platform;
  title: string;
  sub: string;
  done?: boolean;
}) {
  return (
    <>
      {/* Big faint mark in the corner, in the platform's color. */}
      <Icon aria-hidden name={PLATFORM_ICON[platform]} className={css.watermark} />
      <div className="relative flex items-center gap-4 sm:flex-col sm:items-start">
        <span className={cn(css.logo, 'relative')}>
          <PlatformLogo platform={platform} />
          {done && (
            <span className={css.check}>
              <Icon name="check" size="xs" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{title}</p>
          <p className="text-small text-ink-muted">{sub}</p>
        </div>
        {!done && (
          <span className={cn(css.go, 'sm:absolute sm:right-0 sm:top-0')}>
            <Icon name="arrow-right" size="xs" />
          </span>
        )}
      </div>
    </>
  );
}

/** Decorative: the three platforms on curved links flowing into briefluence. */
export function ConnectOrbit({ used }: { used: Platform[] }) {
  const t = useTranslations('verification');
  const pos: Record<Platform, string> = {
    INSTAGRAM: css.p1!,
    TIKTOK: css.p2!,
    YOUTUBE: css.p3!,
  };
  return (
    <div aria-hidden className={css.orbit} title={t('hero.linkLabel')}>
      <svg viewBox="0 0 160 112" className={css.links}>
        {(
          [
            ['INSTAGRAM', 'M30 17 C80 17, 84 56, 126 56'],
            ['TIKTOK', 'M30 56 L126 56'],
            ['YOUTUBE', 'M30 95 C80 95, 84 56, 126 56'],
          ] as const
        ).map(([pl, d]) => (
          <path key={pl} d={d} className={cn(css.link, used.includes(pl) && css.linkOn)} />
        ))}
      </svg>
      <span className={css.hub}>
        <LogoMark className="size-6" />
      </span>
      {PLATFORMS.map((pl) => (
        <span key={pl} className={cn(css.node, pos[pl], used.includes(pl) && css.nodeOn)}>
          <PlatformLogo platform={pl} size="sm" />
        </span>
      ))}
    </div>
  );
}
