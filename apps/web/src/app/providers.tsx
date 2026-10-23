'use client';
import { ToastProvider } from '@briefluence/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { SupportWidget } from '@/components/support/SupportWidget';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const tc = useTranslations('common');
  const tn = useTranslations('notifications');
  // No support chat button in the admin area (or on /support), so toasts sit in the corner.
  const pathname = usePathname();
  const chatButton = !pathname.startsWith('/admin') && !pathname.startsWith('/support');
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider closeLabel={tc('close')} regionLabel={tn('title')} aboveChat={chatButton}>
        {children}
        <SupportWidget />
      </ToastProvider>
    </QueryClientProvider>
  );
}
