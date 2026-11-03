'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/**
 * Underlined tabs that scroll horizontally on narrow screens. Controlled. One underline slides to
 * the selected tab (measured, so it fits any label length or language).
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const tab = el.querySelector<HTMLElement>('[aria-selected="true"]');
      setBar(tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, items.length]);
  return (
    <div
      ref={list}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative -mx-1 flex gap-1 overflow-x-auto border-b border-line px-1',
        className,
      )}
    >
      {bar && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-pill bg-primary transition-[left,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{ left: bar.left, width: bar.width }}
        />
      )}
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-small font-medium transition-colors',
              active ? 'text-primary-text' : 'text-ink-muted hover:text-ink',
              // Before the first measure (and without JS) the selected tab still shows its line.
              active && !bar && 'border-primary',
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  'rounded-pill px-1.5 text-small',
                  active ? 'bg-primary-soft text-primary-text' : 'bg-surface text-ink-muted',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
