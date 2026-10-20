import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

const ASPECT = { wide: 'aspect-[16/9]', photo: 'aspect-[4/3]' } as const;

/**
 * Image at the top of a card (brief cover, blogger photo). `fallback` fills the frame when there is
 * no image. `topLeft`/`topRight` hold `CoverChip`s; `bottom` sits on a dark gradient for legible text.
 * The parent card should be `p={0}` with `overflow-hidden`.
 */
export function MediaCover({
  src,
  alt = '',
  aspect = 'wide',
  fallback,
  topLeft,
  topRight,
  bottom,
  className,
}: {
  src?: string | null;
  alt?: string;
  aspect?: keyof typeof ASPECT;
  fallback?: ReactNode;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottom?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden bg-primary-soft', ASPECT[aspect], className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">{fallback}</div>
      )}
      {(topLeft || topRight) && (
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4">
          <div className="min-w-0">{topLeft}</div>
          <div className="shrink-0">{topRight}</div>
        </div>
      )}
      {bottom && (
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-scrim/85 via-scrim/40 to-transparent px-4 pb-4 pt-12 text-on-scrim">
          {bottom}
        </div>
      )}
    </div>
  );
}

/** Small pill on top of a cover image (followers, platform, match). */
export function CoverChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-pill bg-scrim/65 px-3 py-1 text-small font-bold text-on-scrim backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </span>
  );
}
