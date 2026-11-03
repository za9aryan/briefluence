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
  CoverChip,
  FiltersButton,
  Modal,
  Inline,
  MediaCover,
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
import { DealCoverFallback, dealCover } from '@/components/domain/DealCard';
import { ApplicationStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
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
  const tf = useTranslations('enums.contentFormat');
  const f = useFormat();
  const brandName = useBrandName();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const tc = useTranslations('common');
  const [tab, setTab] = useState<keyof typeof GROUPS>('active');
  const [sheet, setSheet] = useState(false);
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
  const groups = Object.keys(GROUPS) as (keyof typeof GROUPS)[];
  const counts = Object.fromEntries(
    groups.map((g) => [g, all.filter((a) => GROUPS[g].includes(a.status)).length]),
  ) as Record<keyof typeof GROUPS, number>;

  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      {/* Phones: one Filters pill opening a sheet; wider screens keep the tabs. */}
      <div className="flex items-center gap-3 md:hidden">
        <FiltersButton
          label={tc('filters')}
          count={tab === 'active' ? 0 : 1}
          onClick={() => setSheet(true)}
        />
        <Text size="small" tone="muted" className="truncate">
          {t(`tabs.${tab}`)} · {counts[tab]}
        </Text>
      </div>
      <Tabs
        aria-label={t('title')}
        value={tab}
        onChange={setTab}
        className="max-md:hidden"
        items={groups.map((g) => ({ value: g, label: t(`tabs.${g}`), count: counts[g] }))}
      />
      <Modal
        open={sheet}
        onClose={() => setSheet(false)}
        title={tc('filters')}
        closeLabel={tc('close')}
      >
        <div role="radiogroup" aria-label={t('title')} className="-mx-2 flex flex-col">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={tab === g}
              onClick={() => {
                setTab(g);
                setSheet(false);
              }}
              className="flex min-h-12 items-center gap-3 rounded-sm px-2 text-left text-body text-ink hover:bg-surface"
            >
              <span
                aria-hidden
                className={
                  tab === g
                    ? 'inline-flex size-5 items-center justify-center rounded-pill bg-primary text-on-primary'
                    : 'inline-flex size-5 rounded-pill border border-line'
                }
              >
                {tab === g && <Icon name="check" size="xs" />}
              </span>
              <span className="flex-1 font-bold">{t(`tabs.${g}`)}</span>
              <span className="tabular-nums text-ink-muted">{counts[g]}</span>
            </button>
          ))}
        </div>
      </Modal>
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
        <Stack className="bf-stagger" gap={4}>
          {list.map((a) => (
            <Card key={a.id} p={0} className="flex flex-col overflow-hidden sm:flex-row">
              {/* Brief image on the left (on top on phones), status on it. */}
              <MediaCover
                src={dealCover(a.deal)}
                alt={a.deal.title}
                className="sm:aspect-auto sm:min-h-44 sm:w-56 sm:shrink-0 lg:w-64"
                fallback={<DealCoverFallback brand={a.deal.brand} platforms={a.deal.platforms} />}
                topLeft={<ApplicationStatusBadge status={a.status} />}
                bottomLeft={
                  <CoverChip>
                    {a.deal.platforms.map((p) => (
                      <Icon key={p} name={PLATFORM_ICON[p]} size="xs" label={p} />
                    ))}
                    <span className="truncate">
                      {a.deal.contentFormats.map((x) => tf(x)).join(', ')}
                    </span>
                  </CoverChip>
                }
              />
              <Stack gap={4} className="min-w-0 flex-1 p-4 md:p-6">
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
