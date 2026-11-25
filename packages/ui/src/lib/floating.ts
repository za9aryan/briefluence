'use client';
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/** Marks a floating list, so menus around its field don't treat taps or scrolls in it as outside. */
export const FLOATING_ATTR = 'data-floating-list';
export const inFloatingList = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest(`[${FLOATING_ATTR}]`);

/**
 * True when the element is the containing block for fixed descendants (a transform, filter… on
 * it), so their coordinates start at its corner instead of the viewport's.
 * https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
 */
function containsFixed(el: HTMLElement) {
  const s = getComputedStyle(el);
  return (
    s.transform !== 'none' ||
    s.translate !== 'none' ||
    s.filter !== 'none' ||
    s.perspective !== 'none' ||
    (s.backdropFilter ?? 'none') !== 'none' ||
    /paint|layout|strict|content/.test(s.contain) ||
    /transform|filter|perspective/.test(s.willChange)
  );
}

/**
 * Position for a dropdown list under (or, without room, above) its field. Render the list into
 * `host` (a portal): the page body, or the dialog around the field (dialogs sit on top of the
 * page). Out there, menus and modals with their own animation or scroll can neither shift nor
 * clip it; it follows the field while the page scrolls or resizes. At least as wide as the field.
 */
export function useFloatingList(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
): { style: CSSProperties; host: HTMLElement | null } {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' });
      setHost(null);
      return;
    }
    const target = anchor.current?.closest('dialog') ?? document.body;
    if (target !== host) {
      setHost(target);
      return; // place once the list is mounted there
    }
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const below = window.innerHeight - a.bottom - 8;
      const maxHeight = (up: boolean) =>
        Math.max(160, Math.min(256, (up ? a.top : window.innerHeight - a.bottom) - 12));
      const natural = list.current?.scrollHeight ?? 0;
      const up = natural > below && a.top - 8 > below;
      const h = Math.min(natural, maxHeight(up));
      const width = Math.min(a.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, a.left), window.innerWidth - 8 - width);
      const top = up ? a.top - 4 - h : a.bottom + 4;
      // Inside a transformed dialog, fixed coordinates start at the dialog's corner.
      let dx = 0;
      let dy = 0;
      if (host && host !== document.body && containsFixed(host)) {
        const r = host.getBoundingClientRect();
        dx = r.left + host.clientLeft;
        dy = r.top + host.clientTop;
      }
      setStyle({
        left: left - dx,
        top: top - dy,
        minWidth: width,
        maxWidth: window.innerWidth - left - 8,
        maxHeight: maxHeight(up),
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, list, host]);
  return { style, host };
}
