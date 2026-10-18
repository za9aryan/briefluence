'use client';
import type { Platform } from '@briefluence/shared';
import {
  Alert,
  Badge,
  Button,
  Icon,
  Inline,
  Modal,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';

interface HistoryDto {
  account: {
    id: string;
    platform: Platform;
    username: string;
    userId: string;
    displayName: string;
    reviewStatus: string;
  };
  links: {
    id: string;
    handle: string;
    linkedAt: string;
    unlinkedAt: string | null;
    email: string;
    displayName: string | null;
    userDeleted: boolean;
    blocked: boolean;
    current: boolean;
  }[];
}

/** Warning line with a button that opens the account's link history. */
export function ReuseWarning({ accountId }: { accountId: string }) {
  const t = useTranslations('admin.reuse');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Alert
        tone="warning"
        action={
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {t('view')}
          </Button>
        }
      >
        {t('warning')}
      </Alert>
      {open && <ReuseHistoryModal accountId={accountId} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Small badge (Users table) that opens the history of the first flagged account. */
export function ReuseBadge({ accountIds }: { accountIds: string[] }) {
  const t = useTranslations('admin.reuse');
  const [open, setOpen] = useState<string | null>(null);
  if (!accountIds.length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(accountIds[0]!)} className="rounded-pill">
        <Badge tone="danger" icon="warning">
          {t('badge')}
        </Badge>
      </button>
      {open && <ReuseHistoryModal accountId={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * "@fake_acc · Instagram — linked Feb 16 to anna@… (Anna) · removed Mar 18", newest first.
 * The admin allows it (clears the warning), rejects the account, or blocks the user.
 */
export function ReuseHistoryModal({
  accountId,
  onClose,
}: {
  accountId: string;
  onClose: () => void;
}) {
  const t = useTranslations('admin.reuse');
  const tc = useTranslations('common');
  const tp = useTranslations('enums.platform');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'account-history', accountId],
    queryFn: () => api.get<HistoryDto>(`/admin/accounts/${accountId}/history`),
  });
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['admin'] });
    toast(msg);
    onClose();
  };
  const act = useMutation({
    mutationFn: (what: 'allow' | 'reject' | 'block') =>
      what === 'allow'
        ? api.post(`/admin/accounts/${accountId}/allow-reuse`)
        : what === 'reject'
          ? api.post(`/admin/accounts/${accountId}/reject`, { reason: t('rejectReason') })
          : api.post(`/admin/users/${q.data!.account.userId}/block`),
    onSuccess: (_, what) =>
      done(what === 'allow' ? t('allowed') : what === 'reject' ? t('rejected') : t('blockedToast')),
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const a = q.data?.account;

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      closeLabel={tc('close')}
      title={t('title')}
      description={t('lead')}
      footer={
        <>
          <Button
            variant="ghost"
            disabled={!a}
            loading={act.isPending && act.variables === 'block'}
            onClick={() => act.mutate('block')}
          >
            {t('block')}
          </Button>
          {a?.reviewStatus !== 'REJECTED' && (
            <Button
              variant="secondary"
              disabled={!a}
              loading={act.isPending && act.variables === 'reject'}
              onClick={() => act.mutate('reject')}
            >
              {t('reject')}
            </Button>
          )}
          <Button
            disabled={!a}
            loading={act.isPending && act.variables === 'allow'}
            onClick={() => act.mutate('allow')}
          >
            {t('allow')}
          </Button>
        </>
      }
    >
      {!q.data ? (
        <Skeleton className="h-32" />
      ) : (
        <Stack gap={2}>
          {q.data.links.map((l) => (
            <div key={l.id} className="rounded-sm border border-line p-3 text-small">
              <Inline gap={1} wrap>
                <Icon name={PLATFORM_ICON[q.data.account.platform]} />
                <span className="font-bold text-ink">@{l.handle}</span>
                <span className="text-ink-muted">
                  {tp(q.data.account.platform)} — {t('linked', { date: f.date(l.linkedAt) })}
                </span>
                <span className="font-bold text-ink">{l.email}</span>
                {l.displayName && <span className="text-ink-muted">({l.displayName})</span>}
              </Inline>
              <Inline gap={1} wrap className="mt-1">
                {l.current && <Badge tone="primary">{t('current')}</Badge>}
                {l.userDeleted && <Badge>{t('deleted')}</Badge>}
                {l.blocked && <Badge tone="danger">{t('blocked')}</Badge>}
                {l.unlinkedAt && (
                  <Text as="span" size="small" tone="muted">
                    {t('removed', { date: f.date(l.unlinkedAt) })}
                  </Text>
                )}
              </Inline>
            </div>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
