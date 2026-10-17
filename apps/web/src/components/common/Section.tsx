import { Container, Eyebrow, Heading, Stack, Text, cn } from '@briefluence/ui';
import type { ReactNode } from 'react';

/** Marketing section: eyebrow + title + lead, 32px+ between sections (brand rhythm). */
export function Section({
  eyebrow,
  title,
  lead,
  children,
  raised,
  center,
  className,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  raised?: boolean;
  center?: boolean;
  className?: string;
}) {
  return (
    <section className={cn(raised && 'bg-surface-raised', className)}>
      <Container py={{ base: 8, md: 12, lg: 16 }}>
        {(eyebrow || title || lead) && (
          <Stack gap={2} className={cn('mb-8 max-w-2xl md:mb-12', center && 'mx-auto items-center text-center')}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            {title && <Heading level={2}>{title}</Heading>}
            {lead && <Text tone="muted">{lead}</Text>}
          </Stack>
        )}
        {children}
      </Container>
    </section>
  );
}

export function FeatureItem({ icon, title, children }: { icon: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <span className="mb-2 inline-flex size-12 items-center justify-center rounded-card bg-primary-soft text-primary-text">{icon}</span>
      <Heading level={3}>{title}</Heading>
      <Text tone="muted">{children}</Text>
    </Stack>
  );
}
