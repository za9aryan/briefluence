'use client';
import type { FeedQuery, PaymentType, Platform } from '@briefluence/shared';
import { CURRENCY_SYMBOL, toMinor } from '@briefluence/shared';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterDropdown,
  Grid,
  Icon,
  Inline,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Text,
  useToast,
} from '@briefluence/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { DealCard } from '@/components/domain/DealCard';
import { BriefsChecklist } from '@/components/influencer/StartTrial';
import { api } from '@/lib/api';
import { useDisplayCurrency } from '@/lib/hooks/currency';
import { useMe } from '@/lib/hooks/session';
import { useOptions } from '@/lib/hooks/options';
import type { FeedDealDto, InfluencerProfileDto, Paginated } from '@/lib/types';

type Filters = {
  platform: Platform[];
  niche: string[];
  city: string;
  paymentType: PaymentType[];
  budgetMin: string;
  sort: FeedQuery['sort'];
};
const EMPTY: Filters = { platform: [], niche: [], city: '', paymentType: [], budgetMin: '', sort: 'match' };
type Saved = { name: string; query: Partial<Filters> };

/** One horizontal row of filters above the results; wraps onto more lines on narrow screens. */
function FilterBar({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const t = useTranslations('deals');
  const tc = useTranslations('common');
  const currency = useDisplayCurrency();
  const o = useOptions();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const pill = 'h-11 rounded-pill w-auto';
  const active = value.platform.length + value.niche.length + value.paymentType.length + (value.city ? 1 : 0) + (value.budgetMin ? 1 : 0);
  return (
    <div role="toolbar" aria-label={tc('filters')} className="flex flex-wrap items-center gap-2">
      <FilterDropdown label={t('filters.platform')} options={o.platforms} value={value.platform} onChange={(v) => set('platform', v)} clearLabel={tc('clear')} />
      <FilterDropdown label={t('filters.payment')} options={o.paymentTypes} value={value.paymentType} onChange={(v) => set('paymentType', v)} clearLabel={tc('clear')} />
      <FilterDropdown label={t('filters.niche')} options={o.niches} value={value.niche} onChange={(v) => set('niche', v)} clearLabel={tc('clear')} />
      <Select
        aria-label={t('filters.city')}
        value={value.city}
        onChange={(e) => set('city', e.target.value)}
        className={`${pill} ${value.city ? 'border-primary bg-primary-soft font-bold text-primary-text' : ''}`}
      >
        <option value="">{t('filters.city')}: {tc('any')}</option>
        {o.citiesOf(['AM']).map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      <div className="w-52">
        <Input
          aria-label={`${t('filters.budgetMin')} (${currency})`}
          title={t('filters.budgetHint')}
          placeholder={t('filters.budgetMin')}
          type="number"
          inputMode="numeric"
          min={0}
          suffix={CURRENCY_SYMBOL[currency]}
          value={value.budgetMin}
          onChange={(e) => set('budgetMin', e.target.value)}
          className="rounded-pill"
        />
      </div>
      {active > 0 && (
        <Button variant="ghost" size="sm" icon="close" onClick={() => onChange({ ...EMPTY, sort: value.sort })}>
          {tc('clear')}
        </Button>
      )}
      <Select
        aria-label={t('sort.label')}
        value={value.sort}
        onChange={(e) => set('sort', e.target.value as Filters['sort'])}
        className={`${pill} sm:ml-auto`}
      >
        <option value="match">{t('sort.match')}</option>
        <option value="deadline">{t('sort.deadline')}</option>
        <option value="newest">{t('sort.newest')}</option>
      </Select>
    </div>
  );
}

export default function DealFeedPage() {
  const t = useTranslations('deals');
  const tc = useTranslations('common');
  const toast = useToast();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const currency = useDisplayCurrency();
  const { data: me } = useMe();
  const unlocked = !!me?.subscription && me.influencer?.status === 'APPROVED';

  const update = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const query = {
    page,
    pageSize: 12,
    sort: filters.sort,
    platform: filters.platform,
    niche: filters.niche,
    city: filters.city ? [filters.city] : undefined,
    paymentType: filters.paymentType,
    // Entered in the viewer's currency (major units); the API converts it for each deal's currency.
    budgetMin: filters.budgetMin ? toMinor(Number(filters.budgetMin)) : undefined,
    budgetCurrency: filters.budgetMin ? currency : undefined,
  };
  const feed = useQuery({
    queryKey: ['feed', query],
    queryFn: () => api.get<Paginated<FeedDealDto>>('/deals/feed', query),
    placeholderData: keepPreviousData,
    enabled: unlocked,
  });
  const profile = useQuery({ queryKey: ['influencer', 'me'], queryFn: () => api.get<InfluencerProfileDto>('/influencers/me') });
  const saved = (profile.data?.savedFilters ?? []) as Saved[];
  const saveFilters = useMutation({
    mutationFn: (list: Saved[]) => api.put('/influencers/me/saved-filters', { filters: list }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['influencer', 'me'] }),
  });

  const activeCount = filters.platform.length + filters.niche.length + filters.paymentType.length + (filters.city ? 1 : 0) + (filters.budgetMin ? 1 : 0);

  return (
    <Stack gap={6}>
      <PageHeader title={t('feedTitle')} description={t('feedLead')} />

      {unlocked && <FilterBar value={filters} onChange={update} />}

      {(saved.length > 0 || activeCount > 0) && (
        <Inline gap={2} wrap>
          {saved.map((s, i) => (
            <span key={s.name} className="inline-flex items-center rounded-pill border border-line bg-surface-raised">
              <button type="button" className="min-h-11 pl-4 pr-2 text-small font-bold text-ink" onClick={() => update({ ...EMPTY, ...s.query })}>
                {s.name}
              </button>
              <button
                type="button"
                aria-label={tc('remove')}
                className="flex min-h-11 items-center pr-3 text-ink-muted hover:text-primary-text"
                onClick={() => saveFilters.mutate(saved.filter((_, j) => j !== i))}
              >
                <Icon name="close" size="xs" />
              </button>
            </span>
          ))}
          {activeCount > 0 && saved.length < 10 && (
            <Button variant="ghost" size="sm" icon="star" onClick={() => setSaveOpen(true)}>
              {t('saveFilter')}
            </Button>
          )}
        </Inline>
      )}

      <Stack gap={4}>
          {!me ? (
            <Skeleton className="h-64 rounded-card" />
          ) : !unlocked ? (
            <BriefsChecklist />
          ) : feed.isError ? (
            <ErrorState title={tc('errorTitle')} retry={<Button onClick={() => feed.refetch()}>{tc('retry')}</Button>} />
          ) : feed.isLoading ? (
            <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={6}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-64 rounded-card" />
              ))}
            </Grid>
          ) : feed.data?.items.length ? (
            <>
              <Text size="small" tone="muted">
                {t('found', { count: feed.data.total })}
              </Text>
              <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={6}>
                {feed.data.items.map((d) => (
                  <DealCard key={d.id} deal={d} />
                ))}
              </Grid>
              <Pagination
                page={page}
                pageSize={feed.data.pageSize}
                total={feed.data.total}
                onChange={(p) => {
                  setPage(p);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                labels={{
                  prev: tc('previous'),
                  next: tc('next'),
                  summary: tc('showing', { from: (page - 1) * feed.data.pageSize + 1, to: Math.min(page * feed.data.pageSize, feed.data.total), total: feed.data.total }),
                }}
              />
            </>
          ) : (
            <EmptyState
              icon="search"
              title={t('emptyTitle')}
              description={activeCount ? t('emptyFiltered') : t('emptyBody')}
              action={activeCount ? <Button variant="secondary" onClick={() => update({ ...EMPTY, sort: filters.sort })}>{tc('clear')}</Button> : undefined}
            />
          )}
      </Stack>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={t('saveFilter')}
        size="sm"
        closeLabel={tc('close')}
        footer={
          <Button
            disabled={!saveName.trim()}
            loading={saveFilters.isPending}
            onClick={() =>
              saveFilters.mutate([...saved, { name: saveName.trim().slice(0, 40), query: filters }], {
                onSuccess: () => {
                  setSaveOpen(false);
                  setSaveName('');
                  toast(tc('saved'));
                },
              })
            }
          >
            {tc('save')}
          </Button>
        }
      >
        <Field label={t('filterName')}>{({ id }) => <Input id={id} maxLength={40} value={saveName} onChange={(e) => setSaveName(e.target.value)} autoFocus />}</Field>
      </Modal>
    </Stack>
  );
}
