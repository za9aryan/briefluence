import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';

/** Brand: all buttons are pills; one primary (primary) button per screen area. */
const VARIANT = {
  primary: 'bg-primary text-on-primary hover:brightness-95 active:brightness-90',
  secondary: 'border-2 border-primary text-primary-text hover:bg-primary-soft',
  soft: 'bg-primary-soft text-primary-text hover:brightness-97',
  ghost: 'text-ink-muted hover:bg-primary-soft/60 hover:text-ink',
  danger: 'border-2 border-primary-text text-primary-text hover:bg-primary-soft',
  link: 'h-auto! px-0! text-primary-text underline-offset-4 hover:underline',
} as const;

/** Every size keeps a ≥44px touch target. */
const SIZE = {
  sm: 'h-11 px-4 text-small gap-1.5',
  md: 'h-11 px-6 text-body gap-2',
  lg: 'h-14 px-8 text-body gap-2',
  icon: 'size-11',
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

/** Button classes, also used to style links (e.g. Next.js <Link>) as buttons. */
export function buttonStyles({ variant = 'primary', size = 'md', block, className }: ButtonStyleProps = {}) {
  return cn(
    'inline-flex items-center justify-center rounded-pill font-bold whitespace-nowrap transition select-none',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Icon name="spinner" spin /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} />}
    </button>
  );
});
