'use client';
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';

/**
 * A horizontal row that scrolls (with snap) when its items don't fit; swipe on touch screens,
 * arrow buttons on wider ones (shown only when there is more to see). Items keep their own
 * width via `itemClassName` (e.g. "w-44 sm:w-52").
 */
export function Carousel({
  children,
  label,
  prevLabel,
  nextLabel,
  itemClassName,
  className,
}: {
  children: ReactNode;
  /** Accessible name of the region, e.g. "Portfolio". */
  label: string;
  prevLabel: string;
  nextLabel: string;
  itemClassName?: string;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 8,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  }, []);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  };
  const arrow = (dir: 1 | -1) => (
    <button
      type="button"
      aria-label={dir === 1 ? nextLabel : prevLabel}
      onClick={() => page(dir)}
      className={cn(
        'absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-surface-raised text-ink shadow-pop transition hover:border-primary motion-safe:active:scale-95 sm:inline-flex',
        dir === 1 ? '-right-3' : '-left-3',
      )}
    >
      <Icon name={dir === 1 ? 'chevron-right' : 'chevron-left'} size="md" />
    </button>
  );
  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn('relative', className)}
    >
      <div
        ref={track}
        onScroll={measure}
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (c) =>
          c == null ? null : <div className={cn('shrink-0 snap-start', itemClassName)}>{c}</div>,
        )}
      </div>
      {!edge.start && arrow(-1)}
      {!edge.end && arrow(1)}
    </div>
  );
}
