'use client';
import { Heading, Icon, Text, cn } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMe } from '@/lib/hooks/session';
import { useSupportLive } from '@/lib/hooks/supportLive';
import { SUPPORT_KEY, SupportChat, useSupportConversation } from './SupportChat';

/**
 * Chat button in the bottom-right corner of every page (not for admins, who use the inbox,
 * and not on /support, which shows the chat full size). A dot marks a new support reply.
 */
export function SupportWidget() {
  const pathname = usePathname();
  const me = useMe();
  const hidden =
    pathname.startsWith('/admin') || pathname.startsWith('/support') || me.data?.role === 'ADMIN';
  if (hidden || me.isLoading) return null;
  return <Widget signedIn={!!me.data} />;
}

function Widget({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations('support.widget');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const conv = useSupportConversation();
  const hasTicket = !!conv.data?.ticket;
  const unread = !!conv.data?.ticket?.unread && !open;

  // Live updates once there is someone to talk to: a session or a guest conversation.
  useSupportLive(() => void qc.invalidateQueries({ queryKey: SUPPORT_KEY }), signedIn || hasTicket);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={t('title')}
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-surface-raised',
            'sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(40rem,calc(100dvh-8rem))] sm:w-96 sm:rounded-card sm:border sm:border-line sm:shadow-pop',
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4">
            <div>
              <Heading level={2} size="h2">
                {t('title')}
              </Heading>
              <Text size="small" tone="muted">
                {t('subtitle')}
              </Text>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close')}
              className="-m-2 inline-flex size-11 items-center justify-center rounded-pill text-ink-muted hover:bg-surface"
            >
              <Icon name="close" size="md" />
            </button>
          </header>
          <SupportChat active={open} />
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `${t('open')} · ${t('newReply')}` : open ? t('close') : t('open')}
        aria-expanded={open}
        className={cn(
          'fixed bottom-4 right-4 z-40 inline-flex size-14 items-center justify-center rounded-pill bg-primary text-on-primary shadow-pop transition-transform hover:scale-105 sm:bottom-6 sm:right-6',
          open && 'hidden sm:inline-flex',
        )}
      >
        <Icon name={open ? 'close' : 'message'} size="lg" />
        {unread && (
          <span
            className="absolute right-0 top-0 size-4 rounded-pill border-2 border-surface bg-success"
            aria-hidden
          />
        )}
      </button>
    </>
  );
}
