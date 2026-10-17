import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';

/** Pill badges in the brand `label` style. `barter` (sun) is reserved for barter & rewards. */
const TONE = {
  neutral: 'border border-line bg-surface-raised text-ink-muted',
  primary: 'bg-primary-soft text-primary-text',
  barter: 'bg-sun text-ink',
  success: 'bg-success/12 text-success',
  danger: 'bg-primary-soft text-primary-text',
  ink: 'border border-primary/30 bg-surface-raised text-primary-text',
} as const;
export type BadgeTone = keyof typeof TONE;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: IconName;
  /** `label` = 12px uppercase (default); `small` = 13px sentence case for longer text. */
  variant?: 'label' | 'small';
}

export function Badge({ tone = 'neutral', icon, variant = 'label', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-3 py-1 whitespace-nowrap',
        variant === 'label' ? 'text-label uppercase' : 'text-small',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size="xs" />}
      {children}
    </span>
  );
}
