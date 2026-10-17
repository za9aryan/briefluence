'use client';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';
import { Menu } from './Menu';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/**
 * Pill button for a horizontal filter bar that opens a checkbox list (multi-select).
 * Shows the label, the single chosen value, or "label · N" when several are chosen.
 */
export function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  clearLabel,
  align = 'start',
}: {
  label: string;
  options: FilterOption<T>[];
  value: T[];
  onChange: (v: T[]) => void;
  clearLabel: string;
  align?: 'start' | 'end';
}) {
  const active = value.length > 0;
  const summary =
    value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? label) : value.length > 1 ? `${label} · ${value.length}` : label;
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Menu
      align={align}
      className="max-h-80 w-64 overflow-y-auto"
      trigger={(p) => (
        <button
          type="button"
          onClick={p.toggle}
          aria-expanded={p['aria-expanded']}
          aria-haspopup={p['aria-haspopup']}
          className={cn(
            'inline-flex h-11 max-w-56 items-center gap-1.5 rounded-pill border px-4 text-small font-bold whitespace-nowrap transition-colors',
            active ? 'border-primary bg-primary-soft text-primary-text' : 'border-line bg-surface-raised text-ink hover:border-primary/40',
          )}
        >
          <span className="truncate">{summary}</span>
          <Icon name="chevron-down" size="xs" className={cn('transition-transform', p.open && 'rotate-180')} />
        </button>
      )}
    >
      {() => (
        <div role="group" aria-label={label}>
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                onClick={() => toggle(o.value)}
                className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-small text-ink hover:bg-surface"
              >
                <span
                  className={cn(
                    'inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    on ? 'border-primary bg-primary text-on-primary' : 'border-line',
                  )}
                >
                  {on && <Icon name="check" size="xs" />}
                </span>
                {o.icon && <Icon name={o.icon} tone="muted" />}
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex min-h-11 w-full items-center border-t border-line px-4 text-small font-bold text-primary-text hover:bg-surface"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </Menu>
  );
}
