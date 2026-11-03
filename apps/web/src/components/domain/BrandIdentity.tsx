'use client';
import { Avatar, Badge, Card, Icon, Inline, Stack, Text, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { BrandCardDto } from '@/lib/types';

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
        'inline-flex shrink-0 items-center justify-center rounded-sm bg-ink text-surface',
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

/** One-line explanation shown where a confidential brand would normally be. */
export function ConfidentialNote({ className }: { className?: string }) {
  const t = useTranslations('deals.confidential');
  return (
    <Text size="small" tone="muted" className={className}>
      {t('note')}
    </Text>
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
