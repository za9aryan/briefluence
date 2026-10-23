'use client';
import { Heading, Icon, Text, cn } from '@briefluence/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
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

type Phase = 'closed' | 'entering' | 'open' | 'leaving';
const MORPH_MS = 250;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Widget({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations('support.widget');
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('closed');
  const [morph, setMorph] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const open = phase === 'open';
  const conv = useSupportConversation();
  const hasTicket = !!conv.data?.ticket;
  const unread = !!conv.data?.ticket?.unread && phase === 'closed';

  // Live updates once there is someone to talk to: a session or a guest conversation.
  useSupportLive(() => void qc.invalidateQueries({ queryKey: SUPPORT_KEY }), signedIn || hasTicket);

  /**
   * The panel squeezed onto the round button: same corner, same size. A 50% radius on the
   * rectangle becomes a circle after the uneven scale, and the fill is the button's magenta.
   */
  const collapsed = (): CSSProperties => {
    const p = panel.current?.getBoundingClientRect();
    const b = button.current?.getBoundingClientRect();
    if (!p || !b || !p.width || !p.height) return { opacity: 0 };
    return {
      transform: `translate(${b.right - p.right}px, ${b.bottom - p.bottom}px) scale(${b.width / p.width}, ${b.height / p.height})`,
      borderRadius: '50%',
      backgroundColor: 'var(--bf-primary)',
    };
  };

  // Entering: snap to the button before the first paint, then let it grow to its real size.
  useLayoutEffect(() => {
    if (phase !== 'entering') return;
    setMorph(collapsed());
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setMorph({});
        setPhase('open');
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const show = () => setPhase(reducedMotion() ? 'open' : 'entering');
  const hide = useCallback(() => {
    if (reducedMotion()) {
      setPhase('closed');
      button.current?.focus();
      return;
    }
    setMorph(collapsed());
    setPhase('leaving');
    window.setTimeout(() => {
      setPhase('closed');
      setMorph({});
      button.current?.focus();
    }, MORPH_MS);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  return (
    <>
      {phase !== 'closed' && (
        <section
          ref={panel}
          role="dialog"
          aria-label={t('title')}
          style={morph}
          className={cn(
            'fixed inset-0 z-50 flex origin-bottom-right flex-col overflow-hidden bg-surface-raised',
            // No transition on the very first frame: the panel jumps onto the button unseen,
            // then grows from there (otherwise it would first shrink from full size).
            phase === 'entering'
              ? 'transition-none'
              : 'transition-[transform,border-radius,background-color,opacity] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none',
            'sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-96 sm:rounded-card sm:border sm:border-line sm:shadow-pop',
          )}
        >
          {/* Content fades in once the shape has grown, and out first when closing. */}
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col transition-opacity motion-reduce:transition-none',
              open ? 'opacity-100 delay-150 duration-150' : 'opacity-0 duration-75',
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
                onClick={hide}
                aria-label={t('close')}
                className="-m-2 inline-flex size-11 items-center justify-center rounded-pill text-ink-muted hover:bg-surface"
              >
                <Icon name="close" size="md" />
              </button>
            </header>
            <SupportChat active={open} />
          </div>
        </section>
      )}
      <button
        ref={button}
        type="button"
        onClick={show}
        aria-label={unread ? `${t('open')} · ${t('newReply')}` : t('open')}
        aria-expanded={phase !== 'closed'}
        aria-hidden={phase !== 'closed'}
        tabIndex={phase === 'closed' ? 0 : -1}
        className={cn(
          'fixed bottom-4 right-4 z-40 inline-flex size-14 items-center justify-center rounded-pill bg-primary text-on-primary shadow-pop sm:bottom-6 sm:right-6',
          // Opacity swaps instantly: the panel's circle sits exactly here at that moment.
          'transition-transform duration-150 hover:scale-105 motion-reduce:transition-none',
          // While the chat is open the panel *is* the button, so the button steps aside.
          phase === 'closed' ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <Icon name="message" size="lg" />
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
