import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Icon, type IconName } from '../primitives/Icon';
import { Heading, Text } from '../primitives/Typography';

/** Alert tones on brand tokens. `sun` is reserved for barter, so warnings use the primary tint. */
const ALERT = {
  info: { box: 'bg-surface-raised border-line text-ink', icon: 'info' as IconName },
  success: { box: 'bg-success/10 border-success/25 text-ink', icon: 'check-circle' as IconName },
  warning: { box: 'bg-primary-soft border-primary/20 text-ink', icon: 'warning' as IconName },
  danger: { box: 'bg-primary-soft border-primary/30 text-primary-text', icon: 'alert' as IconName },
  brand: { box: 'bg-primary-soft border-primary/20 text-ink', icon: 'sparkles' as IconName },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const a = ALERT[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex flex-col gap-2 rounded-card border p-4 sm:flex-row sm:items-center', a.box, className)}>
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon name={a.icon} size="md" className="mt-px" />
        <div className="min-w-0 text-small">
          {title && <p className="font-bold">{title}</p>}
          {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 pl-8 sm:pl-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-card border border-dashed border-line bg-surface-raised px-6 py-12 text-center', className)}>
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-pill bg-primary-soft">
        <Icon name={icon} size="lg" tone="accent" />
      </span>
      <Heading level={3} size="body">
        {title}
      </Heading>
      {description && (
        <Text tone="muted" className="mt-1 max-w-md">
          {description}
        </Text>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-sm bg-line/70', className)} />;
}

export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-10 text-ink-muted', className)}>
      <Icon name="spinner" size="md" spin />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Error block with retry, for failed queries. */
export function ErrorState({ title, description, retry }: { title: ReactNode; description?: ReactNode; retry?: ReactNode }) {
  return <EmptyState icon="alert" title={title} description={description} action={retry} />;
}
