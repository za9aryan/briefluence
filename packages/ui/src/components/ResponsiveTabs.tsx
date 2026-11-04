'use client';
import { useState } from 'react';
import { Icon } from '../primitives/Icon';
import { FiltersButton } from './FilterSheet';
import { Modal } from './Modal';
import { Tabs, type TabItem } from './Tabs';

/**
 * Status tabs on md+; on phones one "Filters" pill (with the current choice and its count beside
 * it) that opens a bottom sheet to pick one. `defaultValue` is the "no filter" choice: the pill
 * shows a count badge only when something else is picked.
 */
export function ResponsiveTabs<T extends string>({
  items,
  value,
  onChange,
  defaultValue,
  filtersLabel,
  closeLabel,
  'aria-label': ariaLabel,
}: {
  items: (TabItem<T> & { label: string })[];
  value: T;
  onChange: (v: T) => void;
  defaultValue: T;
  filtersLabel: string;
  closeLabel: string;
  'aria-label': string;
}) {
  const [open, setOpen] = useState(false);
  const current = items.find((i) => i.value === value);
  return (
    <>
      <div className="flex min-w-0 items-center gap-3 md:hidden">
        <FiltersButton
          label={filtersLabel}
          count={value === defaultValue ? 0 : 1}
          onClick={() => setOpen(true)}
        />
        {current && (
          <span className="truncate text-small text-ink-muted">
            {current.label}
            {current.count != null && ` · ${current.count}`}
          </span>
        )}
      </div>
      <Tabs
        aria-label={ariaLabel}
        value={value}
        onChange={onChange}
        items={items}
        className="max-md:hidden"
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={filtersLabel}
        closeLabel={closeLabel}
      >
        <div role="radiogroup" aria-label={ariaLabel} className="-mx-2 flex flex-col">
          {items.map((i) => {
            const on = i.value === value;
            return (
              <button
                key={i.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  onChange(i.value);
                  setOpen(false);
                }}
                className="flex min-h-12 items-center gap-3 rounded-sm px-2 text-left text-body text-ink transition-colors hover:bg-surface motion-safe:active:scale-[0.99]"
              >
                <span
                  aria-hidden
                  className={
                    on
                      ? 'inline-flex size-5 items-center justify-center rounded-pill bg-primary text-on-primary'
                      : 'inline-flex size-5 rounded-pill border border-line'
                  }
                >
                  {on && <Icon name="check" size="xs" />}
                </span>
                <span className="flex-1 font-bold">{i.label}</span>
                {i.count != null && <span className="tabular-nums text-ink-muted">{i.count}</span>}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
