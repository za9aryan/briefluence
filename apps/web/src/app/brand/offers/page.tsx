'use client';
import type { CollaborationType, ContentFormat, Platform } from '@briefluence/shared';
import {
  Button,
  Card,
  ChipGroup,
  EmptyState,
  FilterDropdown,
  FiltersButton,
  Grid,
  Icon,
  Inline,
  Input,
  MediaCover,
  Pagination,
  Modal,
  Select,
  SheetSection,
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
import { CollaborationBadge } from '@/components/domain/badges';
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

/** The offer feed API query for a set of filters. */
const feedQuery = (f: Filters, page: number, pageSize: number) => ({
  platform: f.platform.join(',') || undefined,
  format: f.format.join(',') || undefined,
  niche: f.niche.join(',') || undefined,
  collaboration: f.collaboration.join(',') || undefined,
  q: f.q || undefined,
  sort: f.sort,
  page,
  pageSize,
});

const countActive = (f: Filters) =>
  f.platform.length + f.format.length + f.niche.length + f.collaboration.length;

/** Phones: the filters in a bottom sheet; a draft until "Show N offers" (counted live). */
function OfferFilterSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const t = useTranslations('offers');
  const tc = useTranslations('common');
  const td = useTranslations('deals');
  const o = useOptions();
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const q = feedQuery(draft, 1, 1);
  const count = useQuery({
    queryKey: ['offers', 'feed', 'count', q],
    queryFn: () => api.get<Paginated<FeedOfferDto>>('/offers/feed', q),
    placeholderData: keepPreviousData,
    enabled: open,
  });
  const total = count.data?.total;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tc('filters')}
      closeLabel={tc('close')}
      footer={
        <div className="flex w-full gap-2">
          <Button
            variant="secondary"
            onClick={() => setDraft({ ...EMPTY, q: draft.q, sort: draft.sort })}
          >
            {tc('reset')}
          </Button>
          <Button className="flex-1" onClick={() => onApply(draft)}>
            {total == null ? tc('filters') : t('showResults', { count: total })}
          </Button>
        </div>
      }
    >
      <SheetSection title={td('filters.platform')}>
        <ChipGroup
          multiple
          options={o.platforms}
          value={draft.platform}
          onChange={(v) => set('platform', v)}
          aria-label={td('filters.platform')}
        />
      </SheetSection>
      <SheetSection title={t('fields.formats')}>
        <ChipGroup
          multiple
          options={o.formats}
          value={draft.format}
          onChange={(v) => set('format', v)}
          aria-label={t('fields.formats')}
        />
      </SheetSection>
      <SheetSection title={td('filters.collaboration')}>
        <ChipGroup
          multiple
          options={o.collaboration}
          value={draft.collaboration}
          onChange={(v) => set('collaboration', v)}
          aria-label={td('filters.collaboration')}
        />
      </SheetSection>
      <SheetSection title={td('filters.niche')}>
        <ChipGroup
          multiple
          options={o.niches}
          value={draft.niche}
          onChange={(v) => set('niche', v)}
          aria-label={td('filters.niche')}
        />
      </SheetSection>
    </Modal>
  );
}

function Browse() {
  const t = useTranslations('offers');
  const tc = useTranslations('common');
  const td = useTranslations('deals');
  const o = useOptions();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const feed = useQuery({
    queryKey: ['offers', 'feed', filters, page],
    queryFn: () => api.get<Paginated<FeedOfferDto>>('/offers/feed', feedQuery(filters, page, 12)),
    placeholderData: keepPreviousData,
  });

  return (
    <Stack gap={6}>
      <div role="toolbar" aria-label={tc('filters')} className="flex flex-wrap items-center gap-2">
        {/* Phones: search on its own row, then Filters + sort. */}
        <div className="w-full md:w-64">
          <Input
            icon="search"
            aria-label={t('search')}
            placeholder={t('search')}
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            className="h-11 rounded-pill"
          />
        </div>
        <FiltersButton
          label={tc('filters')}
          count={countActive(filters)}
          onClick={() => {
            setSheetKey((k) => k + 1);
            setSheetOpen(true);
          }}
          className="md:hidden"
        />
        <div className="hidden flex-wrap items-center gap-2 md:contents">
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
        </div>
        <Select
          aria-label={t('sortNewest') + ' / ' + t('sortPrice')}
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as Filters['sort'])}
          className="ml-auto h-11 w-auto rounded-pill md:ml-0"
        >
          <option value="newest">{t('sortNewest')}</option>
          <option value="price">{t('sortPrice')}</option>
        </Select>
      </div>
      <OfferFilterSheet
        key={sheetKey}
        open={sheetOpen}
        initial={filters}
        onClose={() => setSheetOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
          setSheetOpen(false);
        }}
      />
      {feed.isLoading ? (
        <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={4}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </Grid>
      ) : !feed.data?.items.length ? (
        <EmptyState
          icon="search"
          title={t('emptyFeed')}
          action={
            filters.q || countActive(filters) ? (
              <Button
                variant="secondary"
                icon="refresh"
                onClick={() => setFilters({ ...EMPTY, sort: filters.sort })}
              >
                {tc('reset')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Grid className="bf-stagger" cols={{ base: 1, md: 2, xl: 3 }} gap={4}>
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
    <Stack className="bf-stagger" gap={4}>
      {list.data.map((r) => (
        <Card key={r.id} p={0} className="flex flex-col overflow-hidden sm:flex-row">
          {/* The offer cover (else the blogger's photo), with the request status on it. */}
          <MediaCover
            src={r.offer.imageUrl ?? r.blogger.coverUrl}
            alt={r.offer.title}
            className="sm:aspect-auto sm:min-h-40 sm:w-56 sm:shrink-0 lg:w-64"
            fallback={<Icon name="sparkles" className="size-16 text-primary/25" />}
            topLeft={<OfferRequestBadge status={r.status} />}
            topRight={<CollaborationBadge type={r.offer.collaborationType} />}
          />
          <Stack gap={2} className="min-w-0 flex-1 p-4 md:p-6">
            <Link
              href={`/brand/offers/${r.offer.id}`}
              className="text-h2 font-bold text-ink hover:text-primary-text"
            >
              {r.offer.title}
            </Link>
            <Text size="small" tone="muted">
              <Link
                href={`/brand/influencers/${r.blogger.id}`}
                className="font-bold text-ink hover:text-primary-text hover:underline"
              >
                {r.blogger.displayName}
              </Link>{' '}
              · {f.date(r.updatedAt)}
            </Text>
            <OfferPrice offer={r.offer} size="body" />
            <Text size="small" tone="muted" className="line-clamp-2 whitespace-pre-line">
              {r.message}
            </Text>
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
