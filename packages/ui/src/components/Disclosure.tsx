import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

/**
 * Expandable question/answer row (FAQ). Native <details>, so it works without JS and is
 * keyboard/screen-reader friendly. Stack several inside a bordered list.
 */
export function Disclosure({
  summary,
  children,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn('group border-b border-line last:border-0', className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-bold text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <Icon
          name="chevron-down"
          className="text-ink-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="pb-4 text-body text-ink-muted">{children}</div>
    </details>
  );
}
