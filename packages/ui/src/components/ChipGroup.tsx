'use client';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';

export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
}

interface BaseProps<T extends string> {
  options: ChipOption<T>[];
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
}

/** Toggle chips for small option sets: multi-select (array) or single-select. */
export function ChipGroup<T extends string>(
  props: BaseProps<T> & ({ multiple: true; value: T[]; onChange: (v: T[]) => void } | { multiple?: false; value: T | null; onChange: (v: T) => void }),
) {
  const { options, disabled, className, invalid } = props;
  const isOn = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: T) => {
    if (props.multiple) props.onChange(isOn(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(v);
  };
  return (
    <div
      role={props.multiple ? 'group' : 'radiogroup'}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-invalid={invalid || undefined}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((o) => {
        const on = isOn(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={props.multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex h-11 items-center gap-1.5 rounded-pill border px-3.5 text-small font-medium transition-colors disabled:opacity-50',
              on
                ? 'border-primary bg-primary text-on-primary'
                : cn('bg-surface-raised text-ink-muted hover:border-primary hover:text-ink', invalid ? 'border-primary-text' : 'border-line'),
            )}
          >
            {o.icon && <Icon name={o.icon} />}
            {o.label}
            {props.multiple && on && <Icon name="check" size="xs" />}
          </button>
        );
      })}
    </div>
  );
}
