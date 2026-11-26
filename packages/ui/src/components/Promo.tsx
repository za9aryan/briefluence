import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';
import { LogoMark } from './Logo';

/**
 * An invitation worth noticing (add the app, turn on notifications): a soft primary panel with a
 * picture, a bold title, one line of why, one action and ✕. Stronger than an Alert; use it for
 * one offer at a time, not for errors or state.
 */
export function Promo({
  visual,
  title,
  children,
  action,
  onDismiss,
  dismissLabel,
  className,
}: {
  visual?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'bf-rise relative overflow-hidden rounded-card border border-primary/20 bg-primary-soft p-4 sm:p-6',
        className,
      )}
    >
      {/* Soft rings in the corner, so the panel reads as an invitation, not a warning. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-pill border-[28px] border-primary/10"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -bottom-20 size-32 rounded-pill border-[16px] border-primary/5"
      />
      <div className="relative flex items-start gap-4 pr-10">
        {visual}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-body font-bold text-ink">{title}</p>
          {children && <p className="text-small text-ink-muted">{children}</p>}
        </div>
      </div>
      {action && <div className="relative mt-4 flex flex-wrap gap-2 sm:pl-[4.5rem]">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-pill text-ink-muted transition-colors hover:bg-primary/10 hover:text-ink"
        >
          <Icon name="close" />
        </button>
      )}
    </section>
  );
}

/** The briefluence app icon with a small badge, as it looks on a Home Screen. */
export function AppIconVisual({ badge = 'bell' }: { badge?: IconName }) {
  return (
    <span aria-hidden className="relative inline-flex shrink-0">
      <span className="inline-flex size-14 items-center justify-center rounded-[14px] bg-primary text-on-primary shadow-pop">
        <LogoMark className="size-8" />
      </span>
      <span className="absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-pill bg-surface-raised text-primary-text ring-2 ring-primary-soft">
        <Icon name={badge} size="xs" />
      </span>
    </span>
  );
}
