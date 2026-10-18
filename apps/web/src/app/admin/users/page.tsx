'use client';
import {
  ROLES,
  type Role,
  type SubscriptionStatus,
  type VerificationStatus,
} from '@briefluence/shared';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Inline,
  Input,
  Menu,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Text,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { IconName } from '@briefluence/ui';
import { PageHeader } from '@/components/app/AppShell';
import { ReuseBadge } from '@/components/admin/AccountReuse';
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
  /** Accounts of this user with an open re-registration warning. */
  reuseWarnings: string[];
}

type SupportAction = 'verify-email' | 'resend-verification' | 'send-password-reset' | 'sign-out';

const ACTIONS: Record<SupportAction, { label: string; toast: string; icon: IconName }> = {
  'verify-email': { label: 'verifyEmail', toast: 'verifiedToast', icon: 'check-circle' },
  'resend-verification': { label: 'resendVerification', toast: 'resentToast', icon: 'mail' },
  'send-password-reset': { label: 'sendReset', toast: 'resetSentToast', icon: 'lock' },
  'sign-out': { label: 'signOut', toast: 'signedOutToast', icon: 'logout' },
};

/** Email actions only make sense for some accounts; blocked users cannot get a reset link. */
const supportActions = (u: UserRow): SupportAction[] => [
  ...(u.emailVerifiedAt ? [] : (['verify-email', 'resend-verification'] as const)),
  ...(u.blockedAt ? [] : (['send-password-reset'] as const)),
  'sign-out',
];

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
  const [state, setState] = useState<'' | 'unverified' | 'blocked'>('');
  const list = useQuery({
    queryKey: ['admin', 'users', role, q, state],
    queryFn: () =>
      api.get<UserRow[]>('/admin/users', {
        role: role || undefined,
        q: q || undefined,
        state: state || undefined,
      }),
  });
  const action = useMutation({
    mutationFn: ({ id, path }: { id: string; path: SupportAction }) =>
      api.post(`/admin/users/${id}/${path}`),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast(t(ACTIONS[v.path].toast));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const block = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      api.post(`/admin/users/${id}/${blocked ? 'block' : 'unblock'}`),
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
        <Input
          icon="search"
          aria-label={tc('search')}
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:w-72"
        />
        <Select
          aria-label={t('role')}
          value={role}
          onChange={(e) => setRole(e.target.value as '' | Role)}
          className="w-auto"
        >
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('stateFilter')}
          value={state}
          onChange={(e) => setState(e.target.value as typeof state)}
          className="w-auto"
        >
          <option value="">{t('allStates')}</option>
          <option value="unverified">{t('stateUnverified')}</option>
          <option value="blocked">{t('stateBlocked')}</option>
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
                  <Text weight="bold">
                    {u.influencer?.displayName ?? u.brand?.companyName ?? '—'}
                  </Text>
                  <Text size="small" tone="muted">
                    {u.email}
                  </Text>
                </TD>
                <TD>{tr(u.role)}</TD>
                <TD>
                  <Inline gap={1} wrap>
                    {u.blockedAt && <Badge tone="danger">{t('isBlocked')}</Badge>}
                    <ReuseBadge accountIds={u.reuseWarnings} />
                    {!u.emailVerifiedAt && <Badge>{t('emailPending')}</Badge>}
                    {u.influencer && <VerificationBadge status={u.influencer.status} />}
                    {u.subscription && <SubscriptionBadge status={u.subscription.status} />}
                  </Inline>
                </TD>
                <TD>{f.date(u.createdAt)}</TD>
                <TD>
                  {u.role !== 'ADMIN' && (
                    <Inline gap={1} justify="end" wrap={false}>
                      <Button
                        size="sm"
                        variant={u.blockedAt ? 'secondary' : 'ghost'}
                        loading={block.isPending && block.variables?.id === u.id}
                        onClick={() => block.mutate({ id: u.id, blocked: !u.blockedAt })}
                      >
                        {u.blockedAt ? t('unblock') : t('block')}
                      </Button>
                      <Menu
                        trigger={(p) => (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('actions')}
                            loading={action.isPending && action.variables?.id === u.id}
                            onClick={p.toggle}
                            aria-expanded={p['aria-expanded']}
                            aria-haspopup={p['aria-haspopup']}
                          >
                            <Icon name="menu" />
                          </Button>
                        )}
                      >
                        {(close) =>
                          supportActions(u).map((path) => (
                            <MenuItem
                              key={path}
                              className="min-h-11 whitespace-nowrap px-4"
                              onClick={() => {
                                close();
                                action.mutate({ id: u.id, path });
                              }}
                            >
                              <Icon name={ACTIONS[path].icon} /> {t(ACTIONS[path].label)}
                            </MenuItem>
                          ))
                        }
                      </Menu>
                    </Inline>
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
