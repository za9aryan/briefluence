'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';

export interface MenuProps {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
  }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
  className?: string;
}

/**
 * Lightweight popover menu: closes on outside click, Escape and scroll. The panel is fixed-positioned
 * so it is not clipped by scrolling containers (tables), and opens upwards when there is no room below.
 */
export function Menu({ trigger, children, align = 'end', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    if (!open || !ref.current || !panel.current) return;
    const t = ref.current.getBoundingClientRect();
    const h = panel.current.offsetHeight;
    const up = t.bottom + 8 + h > window.innerHeight && t.top - 8 - h > 0;
    setPos({
      top: up ? t.top - 8 - h : t.bottom + 8,
      ...(align === 'end'
        ? { right: Math.max(8, window.innerWidth - t.right) }
        : { left: Math.max(8, t.left) }),
    });
  }, [open, align]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    const onScroll = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({
        open,
        toggle: () => {
          setPos({ visibility: 'hidden' });
          setOpen((o) => !o);
        },
        'aria-expanded': open,
        'aria-haspopup': 'menu',
      })}
      {open && (
        <div
          ref={panel}
          role="menu"
          style={pos}
          className={cn(
            'fixed z-50 min-w-48 max-w-[calc(100vw-1rem)] overflow-hidden rounded-sm border border-line bg-surface-raised py-1 shadow-pop',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-small text-ink hover:bg-surface',
        className,
      )}
      {...rest}
    />
  );
}
