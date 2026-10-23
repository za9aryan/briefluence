'use client';
import { SUPPORT_MESSAGE_MAX_LENGTH, SUPPORT_TOPICS, type SupportTopic } from '@briefluence/shared';
import {
  Alert,
  Badge,
  Button,
  ChatBubble,
  ChipGroup,
  Field,
  Icon,
  Input,
  Skeleton,
  Text,
  Textarea,
  cn,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { useMe } from '@/lib/hooks/session';
import { reconnectSupportLive } from '@/lib/hooks/supportLive';
import type { SupportViewDto } from '@/lib/types';

export const SUPPORT_KEY = ['support', 'current'];

/** The requester's conversation; refreshed by live pushes, plus a slow safety poll. */
export function useSupportConversation() {
  return useQuery({
    queryKey: SUPPORT_KEY,
    queryFn: () => api.get<SupportViewDto>('/support/current'),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Picks one image and uploads it to the support attachments endpoint. */
function useAttachment() {
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setUrl((await api.uploadSupport(file)).url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const control = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      onChange={(e) => void pick(e.target.files?.[0])}
    />
  );
  return { url, setUrl, busy, error, open: () => input.current?.click(), control };
}

function AttachmentPreview({ url, onRemove }: { url: string; onRemove: () => void }) {
  const t = useTranslations('support.chat');
  return (
    <div className="relative inline-block self-start">
      <img src={url} alt={t('image')} className="h-16 rounded-sm border border-line object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('removeImage')}
        className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-pill bg-ink text-surface"
      >
        <Icon name="close" size="xs" />
      </button>
    </div>
  );
}

/**
 * Support conversation for the widget and the /support page. Signed-in users write as
 * themselves; guests give an email first (replies also go there). `active`: the chat is on
 * screen, so unread replies are marked read.
 */
export function SupportChat({ active, className }: { active: boolean; className?: string }) {
  const t = useTranslations('support');
  const qc = useQueryClient();
  const me = useMe();
  const conv = useSupportConversation();
  const [startNew, setStartNew] = useState(false);
  const ticket = conv.data?.ticket ?? null;

  // Mark support replies read while the chat is open.
  const ticketId = ticket?.id;
  const unread = ticket?.unread;
  useEffect(() => {
    if (!active || !ticketId || !unread) return;
    void api
      .post(`/support/tickets/${ticketId}/read`)
      .then(() => qc.invalidateQueries({ queryKey: SUPPORT_KEY }));
  }, [active, ticketId, unread, qc]);

  if (conv.isLoading || me.isLoading) return <Skeleton className="m-4 h-48" />;
  const showStart = !ticket || (ticket.status === 'CLOSED' && startNew);
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {showStart ? (
        <StartForm
          signedIn={!!me.data}
          onStarted={() => {
            setStartNew(false);
            // A guest now has a support cookie: rejoin the live channel with it.
            reconnectSupportLive();
          }}
        />
      ) : (
        <Conversation view={conv.data!} onNew={() => setStartNew(true)} />
      )}
      {!ticket && !me.data && (
        <Text size="small" tone="muted" className="px-4 pb-4">
          {t('start.guestNote')}
        </Text>
      )}
    </div>
  );
}

function StartForm({ signedIn, onStarted }: { signedIn: boolean; onStarted: () => void }) {
  const t = useTranslations('support');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const att = useAttachment();
  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () =>
      api.post<SupportViewDto>('/support/tickets', {
        topic,
        body: body.trim(),
        imageUrl: att.url,
        ...(signedIn ? {} : { guestEmail: email.trim(), guestName: name.trim() || null, website }),
      }),
    onSuccess: (view) => {
      qc.setQueryData(SUPPORT_KEY, view);
      onStarted();
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const ready =
    !!topic && (!!body.trim() || !!att.url) && (signedIn || /\S+@\S+\.\S+/.test(email.trim()));

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) start.mutate();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label={t('start.topic')} required>
        {() => (
          <ChipGroup
            aria-label={t('start.topic')}
            options={SUPPORT_TOPICS.map((v) => ({ value: v, label: t(`topics.${v}`) }))}
            value={topic}
            onChange={setTopic}
          />
        )}
      </Field>
      {!signedIn && (
        <>
          <Field label={t('start.email')} hint={t('start.emailHint')} required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label={t('start.name')} aside={<OptionalLabel />}>
            {({ id }) => (
              <Input
                id={id}
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </>
      )}
      <Field
        label={t('start.message')}
        required
        aside={`${body.length}/${SUPPORT_MESSAGE_MAX_LENGTH}`}
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            rows={4}
            maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
            placeholder={t('start.placeholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        )}
      </Field>
      {att.url && <AttachmentPreview url={att.url} onRemove={() => att.setUrl(null)} />}
      {att.error && (
        <Text size="small" className="text-primary-text">
          {att.error}
        </Text>
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={t('chat.attach')}
          loading={att.busy}
          onClick={att.open}
        >
          <Icon name="image" size="md" />
        </Button>
        {att.control}
        <Button type="submit" disabled={!ready} loading={start.isPending}>
          {t('start.send')}
        </Button>
      </div>
    </form>
  );
}

function OptionalLabel() {
  const tc = useTranslations('common');
  return <>{tc('optional')}</>;
}

function Conversation({ view, onNew }: { view: SupportViewDto; onNew: () => void }) {
  const t = useTranslations('support');
  const f = useFormat();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const att = useAttachment();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const ticket = view.ticket!;
  const closed = ticket.status === 'CLOSED';

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [view.messages.length]);

  const send = useMutation({
    mutationFn: () =>
      api.post<SupportViewDto>(`/support/tickets/${ticket.id}/messages`, {
        body: body.trim(),
        imageUrl: att.url,
      }),
    onSuccess: (v) => {
      qc.setQueryData(SUPPORT_KEY, v);
      setBody('');
      att.setUrl(null);
      setError(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const ready = !!body.trim() || !!att.url;
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (ready && !send.isPending) send.mutate();
    }
  };
  const onlyMine = view.messages.every((m) => m.author !== 'ADMIN');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <Text size="small" weight="bold">
          {t(`topics.${ticket.topic}`)}
        </Text>
        <Badge tone={ticket.status === 'ANSWERED' ? 'success' : 'neutral'}>
          {t(`status.${ticket.status}`)}
        </Badge>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" aria-live="polite">
        {view.messages.map((m) => {
          const mine = m.author !== 'ADMIN';
          return (
            <ChatBubble
              key={m.id}
              mine={mine}
              image={m.imageUrl}
              imageAlt={t('chat.image')}
              meta={`${mine ? t('chat.you') : t('chat.support')} · ${f.dateTime(m.createdAt)}`}
            >
              {m.body || null}
            </ChatBubble>
          );
        })}
        {onlyMine && !closed && (
          <Text size="small" tone="muted" className="text-center">
            {t('chat.waiting')}
          </Text>
        )}
        <div ref={end} />
      </div>
      {closed ? (
        <div className="flex flex-col items-center gap-2 border-t border-line p-4">
          <Text size="small" tone="muted">
            {t('chat.closed')}
          </Text>
          <Button size="sm" onClick={onNew}>
            {t('chat.newConversation')}
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 border-t border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) send.mutate();
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          {att.url && <AttachmentPreview url={att.url} onRemove={() => att.setUrl(null)} />}
          {att.error && (
            <Text size="small" className="text-primary-text">
              {att.error}
            </Text>
          )}
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={t('chat.attach')}
              loading={att.busy}
              onClick={att.open}
            >
              <Icon name="image" size="md" />
            </Button>
            {att.control}
            <Textarea
              aria-label={t('chat.placeholder')}
              rows={2}
              maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
              placeholder={t('chat.placeholder')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={onKey}
              className="min-h-11 flex-1"
            />
            <Button
              type="submit"
              size="icon"
              aria-label={t('chat.send')}
              disabled={!ready}
              loading={send.isPending}
            >
              <Icon name="send" size="md" />
            </Button>
          </div>
          <Text size="small" tone="muted" className="hidden sm:block">
            {t('chat.enterHint')}
          </Text>
        </form>
      )}
    </div>
  );
}
