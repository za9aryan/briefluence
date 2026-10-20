import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

/**
 * Expandable question/answer row (FAQ). Native <details>, so it works without JS and is
 * keyboard/screen-reader friendly. Each row has a line under it; "+" turns into "×" when open.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn('group border-b border-line', className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-bold text-ink md:text-[18px] [&::-webkit-details-marker]:hidden">
        {summary}
        <Icon
          name="plus"
          size="lg"
          className="text-ink transition-transform group-open:rotate-45"
        />
      </summary>
      <div className="pb-5 text-body text-ink-muted">{children}</div>
    </details>
  );
}
