import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';

/** Round tinted icon used to mark the kind of an event (notifications, activity). */
const TONE = {
  primary: 'bg-primary-soft text-primary-text',
  success: 'bg-success/12 text-success',
  neutral: 'bg-surface text-ink-muted ring-1 ring-line',
} as const;
export type IconBubbleTone = keyof typeof TONE;

const SIZE = { sm: 'size-8', md: 'size-10' } as const;

export function IconBubble({
  name,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  name: IconName;
  tone?: IconBubbleTone;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-pill',
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      <Icon name={name} size={size === 'sm' ? 'sm' : 'md'} />
    </span>
  );
}
