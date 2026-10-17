'use client';
import { ROLES, type Role, type SubscriptionStatus, type VerificationStatus } from '@briefluence/shared';
import { Badge, Button, EmptyState, Inline, Input, Select, Skeleton, Stack, TBody, TD, TH, THead, TR, Table, Text, useToast } from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { SubscriptionBadge, VerificationBadge } from '@/components/domain/badges';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

interface UserRow {
  id: string;
  email: string;
  role: Role;
  emailVerifiedAt: string | null;
  blockedAt: string | null;
  createdAt: string;
  influencer: { id: string; displayName: string; status: VerificationStatus } | null;
  brand: { id: string; companyName: string } | null;
  subscription: { status: SubscriptionStatus } | null;
}

export default function AdminUsersPage() {
  const t = useTranslations('admin.users');
  const tc = useTranslations('common');
  const tr = useTranslations('enums.role');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [role, setRole] = useState<'' | Role>('');
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin', 'users', role, q], queryFn: () => api.get<UserRow[]>('/admin/users', { role: role || undefined, q: q || undefined }) });
  const block = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => api.post(`/admin/users/${id}/${blocked ? 'block' : 'unblock'}`),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast(v.blocked ? t('blocked') : t('unblocked'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} />
      <Inline gap={2} wrap>
        <Input icon="search" aria-label={tc('search')} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-72" />
        <Select aria-label={t('role')} value={role} onChange={(e) => setRole(e.target.value as '' | Role)} className="w-auto">
          <option value="">{tc('all')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </Select>
      </Inline>
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="users" title={t('empty')} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('user')}</TH>
              <TH>{t('role')}</TH>
              <TH>{t('state')}</TH>
              <TH>{t('joined')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {list.data.map((u) => (
              <TR key={u.id}>
                <TD>
                  <Text weight="bold">{u.influencer?.displayName ?? u.brand?.companyName ?? '—'}</Text>
                  <Text size="small" tone="muted">
                    {u.email}
                  </Text>
                </TD>
                <TD>{tr(u.role)}</TD>
                <TD>
                  <Inline gap={1} wrap>
                    {u.blockedAt && <Badge tone="danger">{t('isBlocked')}</Badge>}
                    {!u.emailVerifiedAt && <Badge>{t('emailPending')}</Badge>}
                    {u.influencer && <VerificationBadge status={u.influencer.status} />}
                    {u.subscription && <SubscriptionBadge status={u.subscription.status} />}
                  </Inline>
                </TD>
                <TD>{f.date(u.createdAt)}</TD>
                <TD>
                  {u.role !== 'ADMIN' && (
                    <Button size="sm" variant={u.blockedAt ? 'secondary' : 'ghost'} loading={block.isPending && block.variables?.id === u.id} onClick={() => block.mutate({ id: u.id, blocked: !u.blockedAt })}>
                      {u.blockedAt ? t('unblock') : t('block')}
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Stack>
  );
}
