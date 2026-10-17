import { Logo as BrandLogo } from '@briefluence/ui';
import Link from 'next/link';

export function Logo({ href = '/', onPrimary, className }: { href?: string; onPrimary?: boolean; className?: string }) {
  return (
    <Link href={href} aria-label="briefluence" className={className}>
      <BrandLogo tone={onPrimary ? 'onPrimary' : 'default'} />
    </Link>
  );
}
