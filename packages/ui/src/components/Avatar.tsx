import { cn } from '../lib/cn';

const SIZE = { xs: 'size-6 text-[10px]', sm: 'size-8 text-label', md: 'size-11 text-small', lg: 'size-14 text-body', xl: 'size-20 text-h2' };

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZE;
  square?: boolean;
  className?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function Avatar({ src, name, size = 'md', square, className }: AvatarProps) {
  const shape = square ? 'rounded-sm' : 'rounded-pill';
  if (src) {
    return <img src={src} alt={name} className={cn('shrink-0 bg-primary-soft object-cover', shape, SIZE[size], className)} />;
  }
  return (
    <span aria-label={name} className={cn('inline-flex shrink-0 items-center justify-center bg-primary-soft font-bold text-primary-text', shape, SIZE[size], className)}>
      {initials(name) || '?'}
    </span>
  );
}
