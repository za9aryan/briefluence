'use client';
import type { DealStatus } from '@briefluence/shared';
import { Badge, Button, Card, EmptyState, Inline, Menu, MenuItem, Icon, Skeleton, Stack, Tabs, Text, buttonStyles } from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { DealStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { useDealActions } from '@/components/brand/useDealActions';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import type { MyDealDto } from '@/lib/types';

type Tab = 'all' | DealStatus;
const TABS: Tab[] = ['all', 'ACTIVE', 'DRAFT', 'PAUSED', 'CLOSED', 'EXPIRED'];

export default function BrandDealsPage() {
  const t = useTranslations('dealForm');
  const tn = useTranslations('nav');
  const td = useTranslations('enums.dealStatus');
  const tc = useTranslations('common');
  const f = useFormat();
  const [tab, setTab] = useState<Tab>('all');
  const deals = useQuery({ queryKey: ['deals', 'mine'], queryFn: () => api.get<MyDealDto[]>('/deals/mine') });
  const act = useDealActions();
  const all = deals.data ?? [];
  const list = tab === 'all' ? all : all.filter((d) => d.status === tab);

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('listTitle')}
        description={t('listLead')}
        actions={
          <Link href="/brand/deals/new" className={buttonStyles({})}>
            <Icon name="plus" /> {tn('newDeal')}
          </Link>
        }
      />
      <Tabs
        aria-label={t('listTitle')}
        value={tab}
        onChange={setTab}
        items={TABS.map((s) => ({ value: s, label: s === 'all' ? tc('all') : td(s), count: s === 'all' ? all.length : all.filter((d) => d.status === s).length }))}
      />
      {deals.isLoading ? (
        <Skeleton className="h-48 rounded-card" />
      ) : list.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Link href="/brand/deals/new" className={buttonStyles({})}>
              {tn('newDeal')}
            </Link>
          }
        />
      ) : (
        <Stack gap={4}>
          {list.map((d) => (
            <Card key={d.id} p={4}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Stack gap={2} className="min-w-0">
                  <Inline gap={2} wrap>
                    <DealStatusBadge status={d.status} />
                    {d.platforms.map((p) => (
                      <Icon key={p} name={PLATFORM_ICON[p]} tone="muted" label={p} />
                    ))}
                    <Text as="span" size="small" tone="muted">
                      {t('until', { date: f.date(d.applicationDeadline) })}
                    </Text>
                  </Inline>
                  <Link href={`/brand/deals/${d.id}/applicants`} className="text-h2 font-bold text-ink hover:text-primary-text">
                    {d.title}
                  </Link>
                  <Compensation compact {...d} />
                </Stack>
                <Inline gap={4} justify={{ base: 'between', md: 'end' }} className="shrink-0">
                  <Stack gap={0} className="text-right">
                    <Inline gap={2} justify="end">
                      <Text weight="bold">{t('applicantsCount', { count: d.applicantCount })}</Text>
                      {d.newApplicantCount > 0 && <Badge tone="primary">{t('newCount', { count: d.newApplicantCount })}</Badge>}
                    </Inline>
                    <Text size="small" tone="muted">
                      {t('filledOf', { filled: d.filled, slots: d.slots })}
                    </Text>
                  </Stack>
                  <Inline gap={1}>
                    <Link href={`/brand/deals/${d.id}/applicants`} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
                      {t('applicants')}
                    </Link>
                    <Menu
                      trigger={(p) => (
                        <Button variant="ghost" size="icon" aria-label={t('actions')} onClick={p.toggle} aria-expanded={p['aria-expanded']} aria-haspopup={p['aria-haspopup']}>
                          <Icon name="menu" />
                        </Button>
                      )}
                    >
                      {(close) => (
                        <>
                          {(d.status === 'DRAFT' || d.status === 'PAUSED') && (
                            <>
                              <Link href={`/brand/deals/${d.id}/edit`} onClick={close} className="flex min-h-11 items-center gap-2 px-4 text-small text-ink hover:bg-surface">
                                <Icon name="edit" /> {tc('edit')}
                              </Link>
                              <MenuItem className="min-h-11 px-4 text-small" onClick={() => { close(); act.mutate({ id: d.id, action: 'publish' }); }}>
                                <Icon name="play" /> {d.status === 'DRAFT' ? t('publish') : t('resume')}
                              </MenuItem>
                            </>
                          )}
                          {d.status === 'ACTIVE' && (
                            <MenuItem className="min-h-11 px-4 text-small" onClick={() => { close(); act.mutate({ id: d.id, action: 'pause' }); }}>
                              <Icon name="pause" /> {t('pause')}
                            </MenuItem>
                          )}
                          {['DRAFT', 'ACTIVE', 'PAUSED'].includes(d.status) && (
                            <MenuItem className="min-h-11 px-4 text-small text-primary-text" onClick={() => { close(); act.mutate({ id: d.id, action: 'close' }); }}>
                              <Icon name="x-circle" /> {t('close')}
                            </MenuItem>
                          )}
                        </>
                      )}
                    </Menu>
                  </Inline>
                </Inline>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
