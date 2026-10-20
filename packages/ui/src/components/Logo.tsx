import type { SVGProps } from 'react';
import { cn } from '../lib/cn';

/** The "b" speech-bubble mark (brand/logos/briefluence-mark.svg), colored with currentColor. */
export function LogoMark({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden
      className={cn('shrink-0', className)}
      {...rest}
    >
      <rect x="18" y="6" width="17" height="72" rx="8.5" />
      <path
        fillRule="evenodd"
        d="M30 56a28 28 0 1 0 56 0a28 28 0 1 0-56 0ZM47 56a11 11 0 1 0 22 0a11 11 0 1 0-22 0Z"
      />
      <path d="M36 74 22 96 48 82Z" />
    </svg>
  );
}

/**
 * Header lockup: mark + 8px gap + lowercase wordmark in Syne 800.
 * `tone="onPrimary"` for primary or dark fills. Min mark size 24px (brand rule).
 * `compact`: only the mark below `sm`, for crowded phone headers.
 */
export function Logo({
  tone = 'default',
  size = 'md',
  compact,
  className,
}: {
  tone?: 'default' | 'onPrimary';
  size?: 'md' | 'lg';
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark
        className={cn(
          size === 'lg' ? 'size-9' : 'size-7',
          tone === 'onPrimary' ? 'text-on-primary' : 'text-primary',
        )}
      />
      <span
        lang="en"
        className={cn(
          'font-display font-extrabold tracking-tight',
          compact && 'hidden sm:inline',
          size === 'lg' ? 'text-h1' : 'text-h2',
          tone === 'onPrimary' ? 'text-on-primary' : 'text-ink',
        )}
      >
        briefluence
      </span>
    </span>
  );
}
