'use client';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app/AppShell';
import { Spinner } from '@briefluence/ui';
import { useMe } from '@/lib/hooks/session';

/** Notifications are shared by all roles: render inside the current user's own shell. */
export default function Layout({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  if (!me) return <Spinner label="…" className="min-h-dvh" />;
  return <AppShell role={me.role}>{children}</AppShell>;
}
