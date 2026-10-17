'use client';
import { useEffect, useRef, type ReactNode } from 'react';
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
 * Full-width bottom sheet on phones, centered card from `sm` up.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeLabel }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-0 mt-auto w-full max-w-none rounded-t-card bg-surface-raised p-0 text-ink shadow-pop backdrop:bg-ink/50 backdrop:backdrop-blur-[2px]',
        'sm:m-auto sm:rounded-card',
        SIZE[size],
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <Heading level={2} size="h2">
                {title}
              </Heading>
              {description && <Text tone="muted" className="mt-1">{description}</Text>}
            </div>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-m-1 rounded-sm p-1 text-ink-muted hover:bg-surface">
              <Icon name="close" size="md" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}
