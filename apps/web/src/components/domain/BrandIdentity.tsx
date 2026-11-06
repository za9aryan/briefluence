'use client';
import { Avatar, Badge, Card, Icon, Inline, Stack, Text, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { BrandCardDto } from '@/lib/types';
import css from './Confidential.module.css';

/** True when the brand is hidden from this blogger (confidential brief, not accepted yet). */
export const isHiddenBrand = (b: Pick<BrandCardDto, 'companyName'>) => !b.companyName;

/** Brand avatar, or a lock tile for a confidential brief. */
export function BrandAvatar({
  brand,
  size = 'md',
}: {
  brand: BrandCardDto;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!isHiddenBrand(brand))
    return <Avatar square size={size} name={brand.companyName!} src={brand.logoUrl} />;
  const dim = { sm: 'size-8', md: 'size-11', lg: 'size-14' }[size];
  return (
    <span
      className={cn(
        css.tile,
        'inline-flex shrink-0 items-center justify-center rounded-sm shadow-pop',
        dim,
      )}
      aria-hidden
    >
      <Icon name="lock" />
    </span>
  );
}

/** Brand name, or "Confidential brand" for a hidden one. */
export function useBrandName() {
  const t = useTranslations('deals.confidential');
  return (b: Pick<BrandCardDto, 'companyName'>) => b.companyName ?? t('name');
}

/**
 * Cover of a confidential brief without its own image: ink with fine stripes, a frosted lock seal
 * and redacted lines. `compact` drops the text (small thumbnails).
 */
export function ConfidentialCover({ compact }: { compact?: boolean }) {
  const t = useTranslations('deals.confidential');
  return (
    <div className={css.cover} aria-hidden>
      {!compact && (
        <div className={css.lines}>
          <span style={{ width: '7rem' }} />
          <span style={{ width: '4.5rem' }} />
        </div>
      )}
      <span className={cn(css.seal, compact && css.sealSmall)}>
        <Icon name="lock" size={compact ? 'sm' : 'md'} />
      </span>
      {!compact && <span className={css.hint}>{t('reveal')}</span>}
    </div>
  );
}

/**
 * Shown where a confidential brand would normally be: a "dossier" with the name blacked out,
 * a stamp, the reason, and the three steps until the name and contacts open.
 */
export function ConfidentialNote({ className }: { className?: string }) {
  const t = useTranslations('deals.confidential');
  const steps = [
    ['send', 'apply'],
    ['check-circle', 'accepted'],
    ['eye', 'open'],
  ] as const;
  return (
    <div className={cn(css.dossier, 'rounded-card p-4', className)}>
      <span className={css.stamp} aria-hidden>
        {t('stamp')}
      </span>
      <div aria-hidden className="flex flex-col gap-2 pr-24">
        <span className={css.redacted} style={{ width: '70%' }} />
        <span className={css.redacted} style={{ width: '45%', opacity: 0.6 }} />
      </div>
      <Text size="small" tone="muted" className="mt-4">
        {t('note')}
      </Text>
      <ol className={'mt-4 flex flex-col gap-2'}>
        {steps.map(([icon, k], i) => (
          <li key={k} className={cn(css.step, 'flex items-center gap-2')}>
            <span
              className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-pill',
                i === steps.length - 1
                  ? 'bg-primary text-on-primary'
                  : 'bg-primary-soft text-primary-text',
              )}
            >
              <Icon name={icon} size="xs" />
            </span>
            <span className="text-small font-bold text-ink">{t(`steps.${k}`)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The brand as a blogger sees it on a brief: logo, name, city, about, links. Also the brand's own
 * "See how it looks" preview, so the two stay the same.
 */
export function BrandAboutCard({ brand }: { brand: BrandCardDto }) {
  const t = useTranslations('deals');
  const brandName = useBrandName();
  return (
    <Card>
      <Inline gap={2}>
        <BrandAvatar brand={brand} />
        <Stack gap={0} className="min-w-0">
          <Text weight="bold" className="wrap-anywhere">
            {brandName(brand)}
          </Text>
          {brand.city && (
            <Text size="small" tone="muted">
              {brand.city}
            </Text>
          )}
        </Stack>
      </Inline>
      {isHiddenBrand(brand) && <ConfidentialNote className="mt-4" />}
      {brand.description && (
        <Text size="small" tone="muted" className="mt-4" clamp={3}>
          {brand.description}
        </Text>
      )}
      <Inline gap={2} wrap className="mt-4">
        {brand.instagramUrl && (
          <a href={brand.instagramUrl} target="_blank" rel="noopener noreferrer">
            <Badge variant="small" icon="instagram">
              Instagram
            </Badge>
          </a>
        )}
        {brand.website && (
          <a href={brand.website} target="_blank" rel="noopener noreferrer">
            <Badge variant="small" icon="globe">
              {t('website')}
            </Badge>
          </a>
        )}
      </Inline>
    </Card>
  );
}
