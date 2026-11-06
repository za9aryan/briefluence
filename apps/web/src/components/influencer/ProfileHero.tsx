'use client';
import { Avatar, Icon, PlatformLogo, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { VerifiedBadge } from '@/components/domain/badges';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { PublicInfluencer } from './PublicProfile';
import css from './ProfileHero.module.css';

/* Tilt and offset of each collage photo (up to four). */
const TILES: CSSProperties[] = [
  { rotate: '-8deg', translate: '0 10%' },
  { rotate: '5deg', translate: '0 -6%' },
  { rotate: '-3deg', translate: '0 14%' },
  { rotate: '9deg', translate: '0 -2%' },
];

const COVER_CLASS = { collage: css.isCollage, ambient: css.isAmbient, brand: css.isBrand };

/**
 * Top of a blogger's profile. The cover is made from their own content, so nobody has to upload
 * one: a tilted collage of their approved work, else their photo blown up into soft color
 * ("ambient"), else a brand gradient. Over it: a large avatar with the verified tick, name,
 * place, niche and language chips, and the platforms with total reach.
 */
export function ProfileHero({ p }: { p: PublicInfluencer }) {
  const t = useTranslations('portfolio.view.hero');
  const tp = useTranslations('enums.platform');
  const o = useOptions();
  const f = useFormat();
  const photos = p.portfolio.map((w) => w.imageUrl).slice(0, 4);
  const mode = photos.length >= 2 ? 'collage' : p.avatarUrl ? 'ambient' : 'brand';
  const reach =
    p.access === 'guest' ? null : p.socialAccounts.reduce((sum, a) => sum + a.followers, 0);
  const place = [p.city, o.country(p.country)].filter(Boolean).join(', ');

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface-raised">
      {/* Cover (decorative) */}
      <div aria-hidden className={cn(css.cover, COVER_CLASS[mode])}>
        {mode === 'ambient' && (
          <span className={css.ambientImg} style={{ backgroundImage: `url(${p.avatarUrl})` }} />
        )}
        {mode === 'collage' && (
          <div className={css.collage}>
            {photos.map((src, i) => (
              <span
                key={src}
                className={css.tile}
                style={{
                  ...TILES[i],
                  backgroundImage: `url(${src})`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            ))}
          </div>
        )}
        <span className={css.sheen} />
        {p.username && (
          <span className={css.handle}>
            <Icon name="link" size="xs" />
            briefluence.com/@{p.username}
          </span>
        )}
      </div>

      <div className="relative px-4 pb-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <span className="relative -mt-14 inline-flex self-start sm:-mt-16">
              <Avatar
                size="xl"
                name={p.displayName}
                src={p.avatarUrl}
                className={cn(css.avatar, 'size-28 text-h1 sm:size-32')}
              />
              {p.verified && (
                <span className={css.tick} aria-hidden>
                  <Icon name="verified" size="md" />
                </span>
              )}
            </span>
            <div className="min-w-0 sm:pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 text-h1 font-extrabold text-ink wrap-anywhere">
                  {p.displayName}
                </h1>
                {p.verified && <VerifiedBadge />}
              </div>
              {place && (
                <p className="mt-1 inline-flex items-center gap-1 text-ink-muted">
                  <Icon name="pin" size="sm" />
                  {place}
                </p>
              )}
            </div>
          </div>

          {/* Platforms and total reach */}
          {p.socialAccounts.length > 0 && (
            <div className="flex items-center gap-4 sm:pb-1">
              <span className="flex -space-x-2">
                {p.socialAccounts.map((a) => (
                  <PlatformLogo
                    key={a.id}
                    platform={a.platform}
                    size="sm"
                    label={tp(a.platform)}
                    className="ring-2 ring-surface-raised"
                  />
                ))}
              </span>
              {reach != null && (
                <span className="flex flex-col">
                  <span className="text-label uppercase text-ink-muted">{t('reach')}</span>
                  <span className="text-h2 font-extrabold tabular-nums text-ink">
                    {f.compact(reach)}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {(p.niches.length > 0 || p.languages.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {p.niches.map((n) => (
              <span key={n} className={css.niche}>
                {o.niche(n)}
              </span>
            ))}
            {p.languages.map((l) => (
              <span key={l} className={css.lang}>
                <Icon name="globe" size="xs" />
                {o.language(l)}
              </span>
            ))}
          </div>
        )}

        {p.bio && (
          <div className={cn(css.bio, 'mt-6')}>
            <p className="text-label uppercase text-primary-text">{t('about')}</p>
            <p className="mt-1 whitespace-pre-line text-ink">{p.bio}</p>
          </div>
        )}
      </div>
    </section>
  );
}
