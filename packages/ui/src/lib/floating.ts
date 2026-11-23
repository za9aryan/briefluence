'use client';
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Position for a dropdown list under (or, without room, above) its field. The list is
 * fixed-positioned, so scrolling containers (modals, tables, menus) never clip it; it follows the
 * field while the page scrolls or resizes. At least as wide as the field.
 */
export function useFloatingList(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' });
      return;
    }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const h = list.current?.offsetHeight ?? 0;
      const below = window.innerHeight - a.bottom - 8;
      const up = h > below && a.top - 8 > below;
      const width = Math.min(a.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, a.left), window.innerWidth - 8 - width);
      setStyle({
        left,
        minWidth: width,
        maxWidth: window.innerWidth - left - 8,
        maxHeight: Math.max(160, Math.min(256, (up ? a.top : window.innerHeight - a.bottom) - 12)),
        ...(up ? { bottom: window.innerHeight - a.top + 4 } : { top: a.bottom + 4 }),
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, list]);
  return style;
}
