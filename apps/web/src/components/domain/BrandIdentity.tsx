'use client';
import { Avatar, Icon, Text, cn } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { BrandCardDto } from '@/lib/types';

/** True when the brand is hidden from this blogger (confidential brief, not accepted yet). */
export const isHiddenBrand = (b: Pick<BrandCardDto, 'companyName'>) => !b.companyName;

/** Brand avatar, or a lock tile for a confidential brief. */
export function BrandAvatar({ brand, size = 'md' }: { brand: BrandCardDto; size?: 'sm' | 'md' | 'lg' }) {
  if (!isHiddenBrand(brand)) return <Avatar square size={size} name={brand.companyName!} src={brand.logoUrl} />;
  const dim = { sm: 'size-8', md: 'size-11', lg: 'size-14' }[size];
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-sm bg-ink text-surface', dim)} aria-hidden>
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
