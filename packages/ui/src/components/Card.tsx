import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Block, type BlockProps } from '../primitives/Block';
import { Heading, Text } from '../primitives/Typography';

export interface CardProps extends BlockProps {
  interactive?: boolean;
}

/** Brand card: surface-raised, border-line, 16px radius, 16px padding (24px from md). */
export const Card = forwardRef<HTMLElement, CardProps>(function Card({ interactive, className, p = { base: 4, md: 6 }, ...rest }, ref) {
  return (
    <Block
      ref={ref}
      surface="raised"
      radius="card"
      bordered
      p={p}
      className={cn('min-w-0', interactive && 'transition hover:border-primary/40 hover:shadow-pop', className)}
      {...rest}
    />
  );
});

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        <Heading level={3}>{title}</Heading>
        {description && (
          <Text size="small" tone="muted" className="mt-1">
            {description}
          </Text>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4', className)} {...rest} />;
}
