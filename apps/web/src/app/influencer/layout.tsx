'use client';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app/AppShell';

export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell role="INFLUENCER">{children}</AppShell>;
}
