import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * One chat message. `mine` sits on the right in the brand tint, the other side on the left.
 * `meta` is a small line under it (author · time). Long words and links wrap.
 */
export function ChatBubble({
  mine,
  meta,
  image,
  imageAlt = '',
  children,
}: {
  mine: boolean;
  meta?: ReactNode;
  /** Optional attached image (opens in a new tab). */
  image?: string | null;
  imageAlt?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex max-w-[85%] flex-col gap-1',
        mine ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-2 rounded-card px-4 py-2 text-body wrap-anywhere',
          mine
            ? 'rounded-br-sm bg-primary-soft text-ink'
            : 'rounded-bl-sm border border-line bg-surface text-ink',
        )}
      >
        {image && (
          <a href={image} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={image}
              alt={imageAlt}
              loading="lazy"
              className="max-h-60 rounded-sm object-contain"
            />
          </a>
        )}
        {children && <p className="whitespace-pre-line">{children}</p>}
      </div>
      {meta && <span className="px-1 text-small text-ink-muted">{meta}</span>}
    </div>
  );
}
