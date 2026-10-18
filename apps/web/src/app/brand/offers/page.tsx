'use client';
import type { CollaborationType, ContentFormat, Platform } from '@briefluence/shared';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FilterDropdown,
  Grid,
  Inline,
  Input,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Tabs,
  Text,
  useToast,
} from '@briefluence/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { ContactLink } from '@/components/domain/ContactLink';
import { OfferCard, OfferPrice, OfferRequestBadge } from '@/components/offers/OfferParts';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { FeedOfferDto, MyOfferRequestDto, Paginated } from '@/lib/types';

type Filters = {
  platform: Platform[];
  format: ContentFormat[];
  niche: string[];
  collaboration: CollaborationType[];
  q: string;
  sort: 'newest' | 'price';
};
const EMPTY: Filters = {
  platform: [],
  format: [],
  niche: [],
  collaboration: [],
  q: '',
  sort: 'newest',
};

function Browse() {
  const t = useTranslations('offers');
  const tc = useTranslations('common');
  const td = useTranslations('deals');
  const o = useOptions();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const feed = useQuery({
    queryKey: ['offers', 'feed', filters, page],
    queryFn: () =>
      api.get<Paginated<FeedOfferDto>>('/offers/feed', {
        platform: filters.platform.join(',') || undefined,
        format: filters.format.join(',') || undefined,
        niche: filters.niche.join(',') || undefined,
        collaboration: filters.collaboration.join(',') || undefined,
        q: filters.q || undefined,
        sort: filters.sort,
        page,
        pageSize: 12,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <Stack gap={6}>
      <div role="toolbar" aria-label={tc('filters')} className="flex flex-wrap items-center gap-2">
        <Input
          icon="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
          className="h-11 rounded-pill sm:w-64"
        />
        <FilterDropdown
          label={td('filters.platform')}
          options={o.platforms}
          value={filters.platform}
          onChange={(v) => set('platform', v)}
          clearLabel={tc('clear')}
        />
        <FilterDropdown
          label={t('fields.formats')}
          options={o.formats}
          value={filters.format}
          onChange={(v) => set('format', v)}
          clearLabel={tc('clear')}
        />
        <FilterDropdown
          label={td('filters.collaboration')}
          options={o.collaboration}
          value={filters.collaboration}
          onChange={(v) => set('collaboration', v)}
          clearLabel={tc('clear')}
        />
        <FilterDropdown
          label={td('filters.niche')}
          options={o.niches}
          value={filters.niche}
          onChange={(v) => set('niche', v)}
          clearLabel={tc('clear')}
        />
        <Select
          aria-label={t('sortNewest') + ' / ' + t('sortPrice')}
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as Filters['sort'])}
          className="h-11 w-auto rounded-pill"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="price">{t('sortPrice')}</option>
        </Select>
      </div>
      {feed.isLoading ? (
        <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={4}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </Grid>
      ) : !feed.data?.items.length ? (
        <EmptyState icon="search" title={t('emptyFeed')} />
      ) : (
        <>
          <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={4}>
            {feed.data.items.map((offer) => (
              <OfferCard key={offer.id} offer={offer} href={`/brand/offers/${offer.id}`} />
            ))}
          </Grid>
          <Pagination
            page={page}
            pageSize={feed.data.pageSize}
            total={feed.data.total}
            onChange={setPage}
            labels={{
              prev: tc('previous'),
              next: tc('next'),
              summary: tc('showing', {
                from: (page - 1) * feed.data.pageSize + 1,
                to: Math.min(page * feed.data.pageSize, feed.data.total),
                total: feed.data.total,
              }),
            }}
          />
        </>
      )}
    </Stack>
  );
}

function MyRequests() {
  const t = useTranslations('offers');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['offers', 'requests', 'mine'],
    queryFn: () => api.get<MyOfferRequestDto[]>('/offer-requests/mine'),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/offer-requests/${id}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['offers'] });
      toast(t('withdrawn'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  if (list.isLoading) return <Skeleton className="h-48 rounded-card" />;
  if (!list.data?.length) return <EmptyState icon="send" title={t('emptyRequests')} />;
  return (
    <Stack gap={4}>
      {list.data.map((r) => (
        <Card key={r.id} p={4}>
          <Stack gap={2}>
            <Inline justify="between" align="start" gap={2}>
              <Inline gap={2} align="center" className="min-w-0">
                <Avatar name={r.blogger.displayName} src={r.blogger.avatarUrl} size="sm" />
                <Stack gap={0} className="min-w-0">
                  <Link
                    href={`/brand/offers/${r.offer.id}`}
                    className="font-bold text-ink hover:text-primary-text"
                  >
                    {r.offer.title}
                  </Link>
                  <Text size="small" tone="muted">
                    {r.blogger.displayName} · {f.date(r.updatedAt)}
                  </Text>
                </Stack>
              </Inline>
              <OfferRequestBadge status={r.status} />
            </Inline>
            <OfferPrice offer={r.offer} size="body" />
            {r.contacts && (
              <Inline gap={2} wrap className="rounded-sm bg-success/10 p-3">
                <Text size="small" weight="bold">
                  {t('bloggerContacts')}:
                </Text>
                <ContactLink method={r.contacts.method} value={r.contacts.value} />
              </Inline>
            )}
            {r.status === 'PENDING' && (
              <Inline justify="end">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={withdraw.isPending && withdraw.variables === r.id}
                  onClick={() => withdraw.mutate(r.id)}
                >
                  {t('withdraw')}
                </Button>
              </Inline>
            )}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function BrandOffers() {
  const t = useTranslations('offers');
  const router = useRouter();
  const tab = useSearchParams().get('tab') === 'requests' ? 'requests' : 'browse';
  return (
    <Stack gap={6}>
      <PageHeader title={t('feedTitle')} description={t('feedLead')} />
      <Tabs
        aria-label={t('feedTitle')}
        value={tab}
        onChange={(v) =>
          router.replace(v === 'requests' ? '/brand/offers?tab=requests' : '/brand/offers')
        }
        items={[
          { value: 'browse', label: t('tabBrowse') },
          { value: 'requests', label: t('tabRequests') },
        ]}
      />
      {tab === 'browse' ? <Browse /> : <MyRequests />}
    </Stack>
  );
}

export default function BrandOffersPage() {
  return (
    <Suspense>
      <BrandOffers />
    </Suspense>
  );
}
