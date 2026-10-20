import { Logo as BrandLogo } from '@briefluence/ui';
import Link from 'next/link';

export function Logo({
  href = '/',
  onPrimary,
  compact,
  className,
}: {
  href?: string;
  onPrimary?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} aria-label="briefluence" className={className}>
      <BrandLogo tone={onPrimary ? 'onPrimary' : 'default'} compact={compact} />
    </Link>
  );
}
