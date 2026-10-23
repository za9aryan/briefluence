'use client';
import { SUPPORT_MESSAGE_MAX_LENGTH, type SupportBox } from '@briefluence/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  ChatBubble,
  EmptyState,
  Icon,
  Inline,
  Select,
  Skeleton,
  Stack,
  Tabs,
  Text,
  Textarea,
  buttonStyles,
  cn,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { useMe } from '@/lib/hooks/session';
import { LIVE, useLive } from '@/lib/hooks/live';
import type { SupportInboxDto, SupportTicketDetailDto } from '@/lib/types';

const BOXES: SupportBox[] = ['unassigned', 'mine', 'open', 'closed'];
const INBOX_KEY = ['admin', 'support'];

/** Support inbox: conversations on the left, the open one on the right (one at a time on phones). */
export default function AdminSupportPage() {
  const t = useTranslations('support.admin');
  const qc = useQueryClient();
  const router = useRouter();
  const [box, setBox] = useState<SupportBox>('unassigned');
  const [selected, setSelected] = useState<string | null>(null);

  // Notification links open a ticket directly: /admin/support?ticket=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('ticket');
    if (id) {
      setSelected(id);
      setBox('open');
    }
  }, []);
  const select = (id: string | null) => {
    setSelected(id);
    router.replace(id ? `/admin/support?ticket=${id}` : '/admin/support');
  };

  const inbox = useQuery({
    queryKey: [...INBOX_KEY, 'inbox', box],
    queryFn: () => api.get<SupportInboxDto>('/admin/support', { box }),
  });
  useLive(LIVE.support, () => void qc.invalidateQueries({ queryKey: INBOX_KEY }));

  const counts = inbox.data?.counts;
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      <Tabs
        aria-label={t('title')}
        value={box}
        onChange={setBox}
        items={BOXES.map((b) => ({
          value: b,
          label: t(`boxes.${b}`),
          count: b === 'closed' ? undefined : counts?.[b],
        }))}
      />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className={cn(selected && 'hidden lg:block')}>
          {inbox.isLoading ? (
            <Skeleton className="h-64 rounded-card" />
          ) : !inbox.data?.items.length ? (
            <EmptyState icon="message" title={t('empty')} />
          ) : (
            <Card p={0} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {inbox.data.items.map((i) => (
                  <li key={i.id}>
                    <InboxRow item={i} active={i.id === selected} onOpen={() => select(i.id)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className={cn(!selected && 'hidden lg:block')}>
          {selected ? (
            <TicketView
              id={selected}
              onBack={() => select(null)}
              // Follow the ticket to the tab it now belongs to, so it stays in the list.
              onAssigned={(assigneeId, mine) =>
                setBox(mine ? 'mine' : assigneeId ? 'open' : 'unassigned')
              }
            />
          ) : (
            <Card className="flex h-64 items-center justify-center">
              <Text tone="muted">{t('pick')}</Text>
            </Card>
          )}
        </div>
      </div>
    </Stack>
  );
}

function InboxRow({
  item: i,
  active,
  onOpen,
}: {
  item: SupportInboxDto['items'][number];
  active: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('support');
  const f = useFormat();
  const name = i.person.name ?? i.person.email ?? '—';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-4 px-4 py-4 text-left hover:bg-surface',
        active && 'bg-primary-soft/60',
      )}
    >
      <Avatar size="sm" name={name} src={i.person.avatarUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span
            className={cn('truncate text-body text-ink', i.unread ? 'font-bold' : 'font-medium')}
          >
            {name}
          </span>
          <span className="shrink-0 text-small text-ink-muted">{f.relative(i.lastMessageAt)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <Badge variant="small">{t(`topics.${i.topic}`)}</Badge>
          {i.person.kind === 'GUEST' && <Badge variant="small">{t('admin.guest')}</Badge>}
          {i.person.blocked && (
            <Badge variant="small" tone="danger">
              {t('admin.blocked')}
            </Badge>
          )}
          {i.unread && <span className="size-2 rounded-pill bg-primary" aria-hidden />}
        </span>
        {i.lastMessage && (
          <span className="line-clamp-2 text-small text-ink-muted wrap-anywhere">
            {i.lastMessage.author === 'ADMIN' ? `${t('chat.support')}: ` : ''}
            {i.lastMessage.body || t('chat.image')}
          </span>
        )}
        {i.waitingSince && (
          <span className="text-small font-bold text-primary-text">
            {t('admin.waiting', { time: f.relative(i.waitingSince) })}
          </span>
        )}
      </span>
    </button>
  );
}

function TicketView({
  id,
  onBack,
  onAssigned,
}: {
  id: string;
  onBack: () => void;
  onAssigned: (assigneeId: string | null, mine: boolean) => void;
}) {
  const t = useTranslations('support');
  const f = useFormat();
  const qc = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const me = useMe().data;
  const [body, setBody] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const key = [...INBOX_KEY, 'ticket', id];
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<SupportTicketDetailDto>(`/admin/support/${id}`),
  });
  const d = q.data;

  // Opening the ticket (and every new message while it is open) marks it read for admins.
  const count = d?.messages.length ?? 0;
  useEffect(() => {
    if (!count) return;
    end.current?.scrollIntoView({ block: 'end' });
    void api
      .post(`/admin/support/${id}/read`)
      .then(() => qc.invalidateQueries({ queryKey: [...INBOX_KEY, 'inbox'] }));
  }, [id, count, qc]);

  const done = (v: SupportTicketDetailDto) => {
    qc.setQueryData(key, v);
    void qc.invalidateQueries({ queryKey: [...INBOX_KEY, 'inbox'] });
  };
  const reply = useMutation({
    mutationFn: () =>
      api.post<SupportTicketDetailDto>(`/admin/support/${id}/messages`, {
        body: body.trim(),
        imageUrl: image,
      }),
    onSuccess: (v) => {
      done(v);
      setBody('');
      setImage(null);
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const assign = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api.post<SupportTicketDetailDto>(`/admin/support/${id}/assign`, { assigneeId }),
    onSuccess: (v) => {
      done(v);
      onAssigned(v.assignee?.id ?? null, !!me && v.assignee?.id === me.id);
      toast(t('admin.assigned'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const setClosed = useMutation({
    mutationFn: (close: boolean) =>
      api.post<SupportTicketDetailDto>(`/admin/support/${id}/${close ? 'close' : 'reopen'}`),
    onSuccess: (v, close) => {
      done(v);
      toast(close ? t('admin.closedToast') : t('admin.reopenedToast'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const pick = async (f2: File | undefined) => {
    if (!f2) return;
    setUploading(true);
    try {
      setImage((await api.uploadSupport(f2)).url);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setUploading(false);
      if (file.current) file.current.value = '';
    }
  };
  const ready = !!body.trim() || !!image;
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (ready && !reply.isPending) reply.mutate();
    }
  };

  if (q.isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (!d) return <EmptyState icon="message" title={t('admin.empty')} />;
  const who = d.account?.name ?? d.guest?.name ?? d.account?.email ?? d.guest?.email ?? '—';

  return (
    <Card p={0} className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line p-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1 self-start text-small font-bold text-primary-text lg:hidden"
        >
          <Icon name="arrow-left" size="xs" /> {t('admin.back')}
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <Stack gap={1} className="min-w-0">
            <Text weight="bold" className="wrap-anywhere">
              {who}
            </Text>
            <Inline gap={1} wrap>
              <Badge variant="small">{t(`topics.${d.topic}`)}</Badge>
              <Badge variant="small" tone={d.status === 'ANSWERED' ? 'success' : 'neutral'}>
                {t(`status.${d.status}`)}
              </Badge>
              {!d.account || d.account.matchedByEmail ? (
                <Badge variant="small">{t('admin.guest')}</Badge>
              ) : null}
            </Inline>
          </Stack>
          <Inline gap={2} wrap>
            {d.status === 'CLOSED' ? (
              <Button
                size="sm"
                variant="secondary"
                loading={setClosed.isPending}
                onClick={() => setClosed.mutate(false)}
              >
                {t('admin.reopen')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                loading={setClosed.isPending}
                onClick={() => setClosed.mutate(true)}
              >
                {t('admin.close')}
              </Button>
            )}
          </Inline>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Text as="span" size="small" tone="muted" className="shrink-0">
            {t('admin.assignee')}
          </Text>
          <div className="min-w-0 flex-1">
            <Select
              aria-label={t('admin.assignee')}
              value={d.assignee?.id ?? ''}
              disabled={assign.isPending}
              onChange={(e) => assign.mutate(e.target.value || null)}
            >
              <option value="">{t('admin.nobody')}</option>
              {d.admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </Select>
          </div>
          {me && d.assignee?.id !== me.id && (
            <Button
              size="sm"
              variant="secondary"
              loading={assign.isPending}
              onClick={() => assign.mutate(me.id)}
            >
              {t('admin.assignToMe')}
            </Button>
          )}
        </div>
        <PersonPanel d={d} />
      </div>

      <div className="flex max-h-[60dvh] min-h-64 flex-col gap-4 overflow-y-auto p-4">
        {d.messages.map((m) => (
          <ChatBubble
            key={m.id}
            mine={m.author === 'ADMIN'}
            image={m.imageUrl}
            imageAlt={t('chat.image')}
            meta={`${m.author === 'ADMIN' ? t('chat.support') : who} · ${f.dateTime(m.createdAt)}`}
          >
            {m.body || null}
          </ChatBubble>
        ))}
        <div ref={end} />
      </div>

      <form
        className="flex flex-col gap-2 border-t border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) reply.mutate();
        }}
      >
        {image && (
          <div className="relative inline-block self-start">
            <img
              src={image}
              alt={t('chat.image')}
              className="h-16 rounded-sm border border-line object-cover"
            />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label={t('chat.removeImage')}
              className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-pill bg-ink text-surface"
            >
              <Icon name="close" size="xs" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={t('chat.attach')}
            loading={uploading}
            onClick={() => file.current?.click()}
          >
            <Icon name="image" size="md" />
          </Button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Textarea
            aria-label={t('admin.replyPlaceholder')}
            rows={2}
            maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
            placeholder={t('admin.replyPlaceholder')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKey}
            className="min-h-11 flex-1"
          />
          <Button type="submit" disabled={!ready} loading={reply.isPending}>
            {t('admin.send')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Who is asking: the signed-in owner, or the account a guest's email belongs to (e.g. blocked). */
function PersonPanel({ d }: { d: SupportTicketDetailDto }) {
  const t = useTranslations('support.admin.person');
  const tr = useTranslations('enums.role');
  const tv = useTranslations('enums.verificationStatus');
  const tp = useTranslations('billing.plans.name');
  const tb = useTranslations('support.admin');
  const f = useFormat();
  const a = d.account;
  return (
    <div className="rounded-card bg-surface p-4">
      <Text size="small" weight="bold">
        {t('title')}
      </Text>
      {d.guest?.email && (
        <Text size="small" className="mt-1 wrap-anywhere">
          {d.guest.email}
        </Text>
      )}
      {a ? (
        <Stack gap={1} className="mt-2">
          {a.matchedByEmail && (
            <Text size="small" tone="muted">
              {t('matched')}
            </Text>
          )}
          <Inline gap={1} wrap>
            <Badge variant="small">{tr(a.role)}</Badge>
            {a.blocked && (
              <Badge variant="small" tone="danger" icon="lock">
                {tb('blocked')}
              </Badge>
            )}
            <Badge variant="small" tone={a.emailVerified ? 'success' : 'neutral'}>
              {a.emailVerified ? t('emailVerified') : t('emailNotVerified')}
            </Badge>
            {a.plan && <Badge variant="small">{tp(a.plan)}</Badge>}
            {a.verification && <Badge variant="small">{tv(a.verification)}</Badge>}
          </Inline>
          <Text size="small" tone="muted" className="wrap-anywhere">
            {a.email} · {t('joined')} {f.date(a.createdAt)}
          </Text>
          <Link
            href={`/admin/users?q=${encodeURIComponent(a.email)}`}
            className={buttonStyles({ variant: 'link', size: 'sm', className: 'self-start' })}
          >
            {t('openUser')}
          </Link>
        </Stack>
      ) : (
        <Text size="small" tone="muted" className="mt-1">
          {t('noAccount')}
        </Text>
      )}
    </div>
  );
}
