'use client';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '../lib/cn';
import { Icon } from '../primitives/Icon';
import { Heading, Text } from '../primitives/Typography';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel: string;
}

const SIZE = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/**
 * Native <dialog>: focus trap, Esc and backdrop close come from the browser.
 * Full-width bottom sheet on phones, centered card from `sm` up. Slides in from below the screen
 * and back out on close (`.bf-modal` in styles.css, 0.2s; none with reduced motion). On phones the
 * sheet has a grab handle: drag the handle or the header down to close it.
 */
const CLOSE_MS = 200;
/** Drag further than this (px), or flick faster than FLICK (px/ms), and the sheet closes. */
const DRAG_CLOSE = 96;
const FLICK = 0.5;

/** Swipe-down-to-close for the bottom sheet (phones only; the centered card does not drag). */
function useDragToClose(ref: RefObject<HTMLDialogElement | null>, onClose: () => void) {
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const reset = () => {
    const d = ref.current;
    d?.style.removeProperty('transform');
    d?.style.removeProperty('transition');
    drag.current = null;
  };
  return {
    onPointerDown(e: PointerEvent) {
      if (!window.matchMedia('(max-width: 639px)').matches || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      drag.current = { y: e.clientY, t: e.timeStamp, dy: 0 };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove(e: PointerEvent) {
      const d = ref.current;
      if (!drag.current || !d) return;
      drag.current.dy = Math.max(0, e.clientY - drag.current.y);
      d.style.transition = 'none';
      d.style.transform = `translateY(${drag.current.dy}px)`;
    },
    onPointerUp(e: PointerEvent) {
      if (!drag.current) return;
      const { dy, t } = drag.current;
      const fast = dy / Math.max(1, e.timeStamp - t) > FLICK;
      // Clearing the inline styles lets the CSS transition finish the slide (out or back up).
      reset();
      if (dy > DRAG_CLOSE || (fast && dy > 24)) onClose();
    },
    onPointerCancel: reset,
  };
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeLabel,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Content stays mounted while the panel slides out, then unmounts (so forms reset as before).
  const [mounted, setMounted] = useState(open);
  const dragHandlers = useDragToClose(ref, onClose);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setMounted(true);
      if (!d.open) d.showModal();
      return;
    }
    if (d.open) d.close();
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'bf-modal m-0 mt-auto w-full max-w-none rounded-t-card bg-surface-raised p-0 text-ink shadow-pop backdrop:bg-ink/50 backdrop:backdrop-blur-[2px]',
        'sm:m-auto sm:rounded-card',
        SIZE[size],
      )}
    >
      {(open || mounted) && (
        <div className="flex max-h-[90dvh] flex-col">
          <div {...dragHandlers} className="touch-none sm:touch-auto">
            <div aria-hidden className="flex justify-center pt-2 sm:hidden">
              <span className="h-1 w-10 rounded-pill bg-line" />
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-2 sm:px-6 sm:pt-4">
              <div>
                <Heading level={2} size="h2">
                  {title}
                </Heading>
                {description && (
                  <Text tone="muted" className="mt-1">
                    {description}
                  </Text>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="-m-1 rounded-sm p-1 text-ink-muted hover:bg-surface"
              >
                <Icon name="close" size="md" />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
