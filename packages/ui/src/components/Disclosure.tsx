'use client';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

/**
 * Expandable question/answer row (FAQ). A button with `aria-expanded` controls the answer, which
 * slides open (grid rows 0fr → 1fr, so the height animates to its natural size) and fades in.
 * Each row has a line under it; "+" turns into "×" when open. No motion with reduced motion.
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
  const [open, setOpen] = useState(!!defaultOpen);
  const id = useId();
  return (
    <div className={cn('border-b border-line', className)}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 py-5 text-left text-body font-bold text-ink md:text-[18px]"
        >
          {summary}
          <Icon
            name="plus"
            size="lg"
            className={cn(
              'text-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              open && 'rotate-45',
            )}
          />
        </button>
      </h3>
      <div
        id={id}
        role="region"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="pb-5 text-body text-ink-muted">{children}</div>
        </div>
      </div>
    </div>
  );
}
