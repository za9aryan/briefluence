import { cn } from '../lib/cn';

export function Divider({ vertical, className }: { vertical?: boolean; className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(vertical ? 'w-px self-stretch bg-line' : 'h-px w-full bg-line', className)}
    />
  );
}
