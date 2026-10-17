import { Container, Stack } from '@briefluence/ui';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { Logo } from '@/components/common/Logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <LanguageSwitcher />
      </Container>
      <main className="flex flex-1 items-start justify-center sm:items-center">
        <Container size="sm" py={{ base: 6, md: 12 }}>
          <Stack gap={6}>{children}</Stack>
        </Container>
      </main>
    </div>
  );
}
