'use client';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';
import { Label, Text } from '../primitives/Typography';
import { Select } from './Select';

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Text shown next to the label, e.g. "Optional". */
  aside?: ReactNode;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Set by <FieldGrid>: fields inside it share label / control / message rows via CSS subgrid. */
export const FieldGridContext = createContext(false);

/** Label + control + hint/error, wired for accessibility. */
export function Field({ label, hint, error, required, aside, className, children }: FieldProps) {
  const id = useId();
  const inGrid = useContext(FieldGridContext);
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy =
    [error ? errId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  const header =
    label || aside ? (
      <div
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5',
          inGrid && 'self-end',
        )}
      >
        {label && (
          <Label htmlFor={id}>
            {label}
            {required && <span className="ml-0.5 text-primary-text">*</span>}
          </Label>
        )}
        {aside && (
          <Text as="span" size="small" tone="muted" className="whitespace-nowrap">
            {aside}
          </Text>
        )}
      </div>
    ) : null;
  const message = error ? (
    <Text id={errId} size="small" tone="danger" role="alert">
      {error}
    </Text>
  ) : hint ? (
    <Text id={hintId} size="small">
      {hint}
    </Text>
  ) : null;

  if (inGrid) {
    // Three shared rows (label, control, message): inputs line up even when one label wraps.
    return (
      <div className={cn('row-span-3 grid min-w-0 grid-rows-subgrid gap-y-1.5', className)}>
        {header ?? <div />}
        <div className="min-w-0">{children({ id, describedBy, invalid: !!error })}</div>
        {message ?? <div />}
      </div>
    );
  }
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {header}
      {children({ id, describedBy, invalid: !!error })}
      {message}
    </div>
  );
}

// Touch screens get 16px text: iOS Safari zooms the page into any field with smaller text.
const control =
  'w-full rounded-sm border border-line bg-surface-raised text-small pointer-coarse:text-body text-ink placeholder:text-ink-muted transition-colors ' +
  'focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 ' +
  'disabled:cursor-not-allowed disabled:bg-surface aria-invalid:border-primary-text aria-invalid:ring-primary-text/10';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: IconName;
  suffix?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, suffix, invalid, className, ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center">
      {icon && <Icon name={icon} tone="muted" className="pointer-events-none absolute left-3" />}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          control,
          'h-11 px-3',
          icon && 'pl-9',
          suffix ? 'pr-14' : undefined,
          className,
        )}
        {...rest}
        // Without spinners, scrolling over a focused number field would silently change its value.
        onWheel={
          rest.type === 'number'
            ? (e) => {
                e.currentTarget.blur();
                rest.onWheel?.(e);
              }
            : rest.onWheel
        }
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 text-small text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, rows = 4, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(control, 'px-3 py-2 leading-relaxed', className)}
      {...rest}
    />
  );
});

/**
 * A text field with a fixed grey block in front (e.g. "briefluence.com/@"), so people type only
 * their part. The block is decorative: give the field a label that says what goes in.
 */
export const PrefixInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'suffix'> & { prefix: ReactNode }
>(function PrefixInput({ prefix, icon, invalid, className, ...rest }, ref) {
  return (
    <div
      className={cn(
        'flex h-11 w-full items-stretch overflow-hidden rounded-sm border bg-surface-raised transition-colors',
        'focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15',
        invalid ? 'border-primary-text' : 'border-line',
        className,
      )}
    >
      <span
        aria-hidden
        className="flex shrink-0 select-none items-center gap-1.5 border-r border-line bg-surface px-3 text-small text-ink-muted pointer-coarse:text-body"
      >
        {icon && <Icon name={icon} size="sm" />}
        {prefix}
      </span>
      <input
        ref={ref}
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent px-3 text-small text-ink outline-none placeholder:text-ink-muted pointer-coarse:text-body"
        {...rest}
      />
    </div>
  );
});

/**
 * A web address: a grey "https://" block in front, so people type just "instagram.com/ani".
 * A pasted full link loses its scheme as it lands in the field (no "https://https://"); the shared
 * `webUrl` schema puts it back. Works with react-hook-form's register or as a controlled input.
 */
export const UrlInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'suffix'>>(
  function UrlInput({ onChange, ...rest }, ref) {
    return (
      <PrefixInput
        ref={ref}
        prefix="https://"
        inputMode="url"
        autoComplete="url"
        {...rest}
        onChange={(e) => {
          const bare = e.target.value.replace(/^\s*https?:\/\//i, '');
          if (bare !== e.target.value) e.target.value = bare;
          onChange?.(e);
        }}
      />
    );
  },
);

/**
 * An amount with its currency picked inside the same field ("12 000 | ֏ AMD ▾"), so changing the
 * currency visibly changes the amount's unit. `currency` is the chosen code and its setter;
 * `currencies` are the choices.
 */
export const AmountInput = forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'suffix' | 'icon'> & {
    currency: { value: string; onChange: (v: string) => void };
    currencies: { value: string; label: string }[];
    currencyLabel: string;
  }
>(function AmountInput({ currency, currencies, currencyLabel, invalid, className, ...rest }, ref) {
  return (
    <div
      className={cn(
        'flex h-11 w-full items-stretch rounded-sm border bg-surface-raised transition-colors',
        'focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/15',
        invalid ? 'border-primary-text' : 'border-line',
        className,
      )}
    >
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 rounded-l-sm bg-transparent px-3 text-small text-ink outline-none placeholder:text-ink-muted pointer-coarse:text-body"
        {...rest}
        onWheel={
          rest.type === 'number'
            ? (e) => {
                e.currentTarget.blur();
                rest.onWheel?.(e);
              }
            : rest.onWheel
        }
      />
      <Select
        variant="inline"
        aria-label={currencyLabel}
        options={currencies}
        value={currency.value}
        onChange={currency.onChange}
        className="shrink-0 border-l border-line"
      />
    </div>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label htmlFor={inputId} className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line accent-primary"
        {...rest}
      />
      <span className="flex flex-col">
        <span className="text-small text-ink">{label}</span>
        {description && <span className="text-small text-ink-muted">{description}</span>}
      </span>
    </label>
  );
});

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="flex flex-col">
        <span className="text-small font-medium text-ink">{label}</span>
        {description && <span className="text-small text-ink-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-pill bg-surface-raised shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
