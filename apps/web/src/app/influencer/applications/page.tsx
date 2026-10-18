'use client';
import {
  canWithdraw,
  contactDisplay,
  contactHref,
  type ApplicationStatus,
} from '@briefluence/shared';
import {
  Alert,
  Button,
  Icon,
  Card,
  EmptyState,
  Inline,
  Skeleton,
  Stack,
  Tabs,
  Text,
  buttonStyles,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { CONTACT_ICON } from '@/components/brand/ContactMethodFields';
import { BrandAvatar, useBrandName } from '@/components/domain/BrandIdentity';
import { ApplicationStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { MyApplicationDto } from '@/lib/types';

/** Tabs in the order an application moves: in progress → shortlisted → accepted, or closed. */
const GROUPS: Record<'active' | 'shortlisted' | 'accepted' | 'closed', ApplicationStatus[]> = {
  active: ['APPLIED', 'VIEWED'],
  shortlisted: ['SHORTLISTED'],
  accepted: ['ACCEPTED', 'COMPLETED'],
  closed: ['REJECTED', 'WITHDRAWN'],
};

export default function MyApplicationsPage() {
  const t = useTranslations('applications');
  const tr = useTranslations('enums.rejectionReason');
  const tm = useTranslations('enums.contactMethod');
  const f = useFormat();
  const brandName = useBrandName();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [tab, setTab] = useState<keyof typeof GROUPS>('active');
  const apps = useQuery({
    queryKey: ['applications', 'mine'],
    queryFn: () => api.get<MyApplicationDto[]>('/applications/mine'),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/applications/${id}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['applications'] });
      toast(t('withdrawn'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  const all = apps.data ?? [];
  const list = all.filter((a) => GROUPS[tab].includes(a.status));

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      <Tabs
        aria-label={t('title')}
        value={tab}
        onChange={setTab}
        items={(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => ({
          value: g,
          label: t(`tabs.${g}`),
          count: all.filter((a) => GROUPS[g].includes(a.status)).length,
        }))}
      />
      {apps.isLoading ? (
        <Skeleton className="h-48 rounded-card" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="send"
          title={t(`empty.${tab}`)}
          action={
            <Link href="/influencer/deals" className={buttonStyles({})}>
              {t('findDeals')}
            </Link>
          }
        />
      ) : (
        <Stack gap={4}>
          {list.map((a) => (
            <Card key={a.id}>
              <Stack gap={4}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <Inline gap={2} align="start" className="min-w-0">
                    <BrandAvatar brand={a.deal.brand} />
                    <div className="min-w-0">
                      <Link
                        href={`/influencer/deals/${a.deal.id}`}
                        className="text-h2 font-bold text-ink hover:text-primary-text"
                      >
                        {a.deal.title}
                      </Link>
                      <Text size="small" tone="muted">
                        {brandName(a.deal.brand)} · {t('appliedOn', { date: f.date(a.createdAt) })}{' '}
                        · {t('matchValue', { score: a.matchScore })}
                      </Text>
                    </div>
                  </Inline>
                  <ApplicationStatusBadge status={a.status} />
                </div>
                <Compensation compact {...a.deal} />
                {a.proposedPrice != null && (
                  <Text size="small" tone="muted">
                    {t('yourPrice', { price: f.display(a.proposedPrice, a.deal.currency).main })}
                  </Text>
                )}
                {a.status === 'REJECTED' && (
                  <Alert tone="info">
                    {t('rejectedReason', {
                      reason: a.rejectionReason ? tr(a.rejectionReason as 'OTHER') : tr('OTHER'),
                    })}
                  </Alert>
                )}
                {a.brandContact && (
                  <Alert
                    tone="success"
                    title={a.status === 'COMPLETED' ? t('doneTitle') : t('collabTitle')}
                  >
                    <Stack gap={1}>
                      <span className="mb-1">
                        {a.status === 'COMPLETED' ? t('doneBody') : t('collabBody')}
                      </span>
                      {(a.brandContact.name || a.brandContact.position) && (
                        <span>
                          {[a.brandContact.name, a.brandContact.position]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {a.brandContact.method && a.brandContact.value && (
                        <a
                          href={
                            contactHref(a.brandContact.method, a.brandContact.value) ?? undefined
                          }
                          target={a.brandContact.method === 'PHONE' ? undefined : '_blank'}
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold underline"
                        >
                          <Icon name={CONTACT_ICON[a.brandContact.method]} />
                          {tm(a.brandContact.method)}:{' '}
                          {contactDisplay(a.brandContact.method, a.brandContact.value)}
                        </a>
                      )}
                      {a.deal.publishBy && (
                        <span>{t('publishBy', { date: f.date(a.deal.publishBy) })}</span>
                      )}
                    </Stack>
                  </Alert>
                )}
                {a.status === 'COMPLETED' && a.postUrl && (
                  <a
                    href={a.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-small font-bold text-primary-text hover:underline"
                  >
                    {t('viewPost')}
                  </a>
                )}
                {canWithdraw(a.status) && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={withdraw.isPending && withdraw.variables === a.id}
                      onClick={() => withdraw.mutate(a.id)}
                    >
                      {t('withdraw')}
                    </Button>
                  </div>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
