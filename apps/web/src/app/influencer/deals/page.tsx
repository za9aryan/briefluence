'use client';
import type { CollaborationType, FeedQuery, PaymentType, Platform } from '@briefluence/shared';
import { CURRENCY_SYMBOL, toMinor } from '@briefluence/shared';
import {
  Button,
  ChipGroup,
  EmptyState,
  ErrorState,
  Field,
  FilterDropdown,
  FiltersButton,
  Grid,
  Icon,
  Inline,
  Input,
  Modal,
  Pagination,
  Select,
  SheetSection,
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
  collaboration: CollaborationType[];
  budgetMin: string;
  sort: FeedQuery['sort'];
};
const EMPTY: Filters = {
  platform: [],
  niche: [],
  city: '',
  paymentType: [],
  collaboration: [],
  budgetMin: '',
  sort: 'match',
};
type Saved = { name: string; query: Partial<Filters> };

const countActive = (f: Filters) =>
  f.platform.length +
  f.niche.length +
  f.paymentType.length +
  f.collaboration.length +
  (f.city ? 1 : 0) +
  (f.budgetMin ? 1 : 0);

/** The feed API query for a set of filters (budget typed in the viewer's currency). */
function feedQuery(f: Filters, page: number, pageSize: number, currency: string) {
  return {
    page,
    pageSize,
    sort: f.sort,
    platform: f.platform,
    niche: f.niche,
    city: f.city ? [f.city] : undefined,
    paymentType: f.paymentType,
    collaboration: f.collaboration,
    // Entered in the viewer's currency (major units); the API converts it for each deal's currency.
    budgetMin: f.budgetMin ? toMinor(Number(f.budgetMin)) : undefined,
    budgetCurrency: f.budgetMin ? currency : undefined,
  };
}

/**
 * Phones: every filter in a bottom sheet. Choices are a draft until "Show N briefs", so the list
 * behind does not jump while choosing; N is counted live for the draft.
 */
function FilterSheet({
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
  const t = useTranslations('deals');
  const tc = useTranslations('common');
  const currency = useDisplayCurrency();
  const o = useOptions();
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const q = feedQuery(draft, 1, 1, currency);
  const count = useQuery({
    queryKey: ['feed', 'count', q],
    queryFn: () => api.get<Paginated<FeedDealDto>>('/deals/feed', q),
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
          <Button variant="secondary" onClick={() => setDraft({ ...EMPTY, sort: draft.sort })}>
            {tc('reset')}
          </Button>
          <Button
            className="flex-1"
            loading={count.isFetching && total == null}
            onClick={() => onApply(draft)}
          >
            {total == null ? tc('filters') : t('showResults', { count: total })}
          </Button>
        </div>
      }
    >
      <SheetSection title={t('filters.platform')}>
        <ChipGroup
          multiple
          options={o.platforms}
          value={draft.platform}
          onChange={(v) => set('platform', v)}
          aria-label={t('filters.platform')}
        />
      </SheetSection>
      <SheetSection title={t('filters.payment')}>
        <ChipGroup
          multiple
          options={o.paymentTypes}
          value={draft.paymentType}
          onChange={(v) => set('paymentType', v)}
          aria-label={t('filters.payment')}
        />
      </SheetSection>
      <SheetSection title={t('filters.collaboration')}>
        <ChipGroup
          multiple
          options={o.collaboration}
          value={draft.collaboration}
          onChange={(v) => set('collaboration', v)}
          aria-label={t('filters.collaboration')}
        />
      </SheetSection>
      <SheetSection title={t('filters.niche')}>
        <ChipGroup
          multiple
          options={o.niches}
          value={draft.niche}
          onChange={(v) => set('niche', v)}
          aria-label={t('filters.niche')}
        />
      </SheetSection>
      <SheetSection title={t('filters.city')}>
        <Select
          aria-label={t('filters.city')}
          value={draft.city}
          onChange={(e) => set('city', e.target.value)}
        >
          <option value="">{tc('any')}</option>
          {o.citiesOf(['AM']).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </SheetSection>
      <SheetSection title={`${t('filters.budgetMin')} (${currency})`}>
        <Input
          aria-label={`${t('filters.budgetMin')} (${currency})`}
          placeholder={t('filters.budgetHint')}
          type="number"
          inputMode="numeric"
          min={0}
          suffix={CURRENCY_SYMBOL[currency]}
          value={draft.budgetMin}
          onChange={(e) => set('budgetMin', e.target.value)}
        />
      </SheetSection>
    </Modal>
  );
}

function SortSelect({
  value,
  onChange,
  className,
}: {
  value: Filters['sort'];
  onChange: (v: Filters['sort']) => void;
  className?: string;
}) {
  const t = useTranslations('deals');
  return (
    <Select
      aria-label={t('sort.label')}
      value={value}
      onChange={(e) => onChange(e.target.value as Filters['sort'])}
      className={`h-11 w-auto rounded-pill ${className ?? ''}`}
    >
      <option value="match">{t('sort.match')}</option>
      <option value="deadline">{t('sort.deadline')}</option>
      <option value="newest">{t('sort.newest')}</option>
    </Select>
  );
}

/** One horizontal row of filters above the results; wraps onto more lines on narrow screens. */
function FilterBar({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const t = useTranslations('deals');
  const tc = useTranslations('common');
  const currency = useDisplayCurrency();
  const o = useOptions();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const pill = 'h-11 rounded-pill w-auto';
  const active = countActive(value);
  return (
    <div role="toolbar" aria-label={tc('filters')} className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        label={t('filters.platform')}
        options={o.platforms}
        value={value.platform}
        onChange={(v) => set('platform', v)}
        clearLabel={tc('clear')}
      />
      <FilterDropdown
        label={t('filters.payment')}
        options={o.paymentTypes}
        value={value.paymentType}
        onChange={(v) => set('paymentType', v)}
        clearLabel={tc('clear')}
      />
      <FilterDropdown
        label={t('filters.collaboration')}
        options={o.collaboration}
        value={value.collaboration}
        onChange={(v) => set('collaboration', v)}
        clearLabel={tc('clear')}
      />
      <FilterDropdown
        label={t('filters.niche')}
        options={o.niches}
        value={value.niche}
        onChange={(v) => set('niche', v)}
        clearLabel={tc('clear')}
      />
      <Select
        aria-label={t('filters.city')}
        value={value.city}
        onChange={(e) => set('city', e.target.value)}
        className={`${pill} ${value.city ? 'border-primary bg-primary-soft font-bold text-primary-text' : ''}`}
      >
        <option value="">
          {t('filters.city')}: {tc('any')}
        </option>
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
        <Button
          variant="ghost"
          size="sm"
          icon="close"
          onClick={() => onChange({ ...EMPTY, sort: value.sort })}
        >
          {tc('clear')}
        </Button>
      )}
      <SortSelect value={value.sort} onChange={(v) => set('sort', v)} className="sm:ml-auto" />
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
  const [sheetOpen, setSheetOpen] = useState(false);
  // A new key on each open restarts the sheet's draft from the filters in use.
  const [sheetKey, setSheetKey] = useState(0);
  const openSheet = () => {
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  };
  const currency = useDisplayCurrency();
  const { data: me } = useMe();
  const unlocked = !!me?.subscription && me.influencer?.status === 'APPROVED';

  const update = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const query = feedQuery(filters, page, 12, currency);
  const feed = useQuery({
    queryKey: ['feed', query],
    queryFn: () => api.get<Paginated<FeedDealDto>>('/deals/feed', query),
    placeholderData: keepPreviousData,
    enabled: unlocked,
  });
  const profile = useQuery({
    queryKey: ['influencer', 'me'],
    queryFn: () => api.get<InfluencerProfileDto>('/influencers/me'),
  });
  const saved = (profile.data?.savedFilters ?? []) as Saved[];
  const saveFilters = useMutation({
    mutationFn: (list: Saved[]) => api.put('/influencers/me/saved-filters', { filters: list }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['influencer', 'me'] }),
  });

  const activeCount = countActive(filters);

  return (
    <Stack gap={6}>
      <PageHeader title={t('feedTitle')} />

      {unlocked && (
        <>
          <div className="flex items-center gap-2 md:hidden">
            <FiltersButton label={tc('filters')} count={activeCount} onClick={openSheet} />
            <SortSelect
              value={filters.sort}
              onChange={(sort) => update({ ...filters, sort })}
              className="ml-auto"
            />
          </div>
          <div className="hidden md:block">
            <FilterBar value={filters} onChange={update} />
          </div>
          {
            <FilterSheet
              key={sheetKey}
              open={sheetOpen}
              initial={filters}
              onClose={() => setSheetOpen(false)}
              onApply={(f) => {
                update(f);
                setSheetOpen(false);
              }}
            />
          }
        </>
      )}

      {(saved.length > 0 || activeCount > 0) && (
        <Inline gap={2} wrap>
          {saved.map((s, i) => (
            <span
              key={s.name}
              className="inline-flex items-center rounded-pill border border-line bg-surface-raised"
            >
              <button
                type="button"
                className="min-h-11 pl-4 pr-2 text-small font-bold text-ink"
                onClick={() => update({ ...EMPTY, ...s.query })}
              >
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
          <ErrorState
            title={tc('errorTitle')}
            retry={<Button onClick={() => feed.refetch()}>{tc('retry')}</Button>}
          />
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
                summary: tc('showing', {
                  from: (page - 1) * feed.data.pageSize + 1,
                  to: Math.min(page * feed.data.pageSize, feed.data.total),
                  total: feed.data.total,
                }),
              }}
            />
          </>
        ) : (
          <EmptyState
            icon="search"
            title={t('emptyTitle')}
            description={activeCount ? t('emptyFiltered') : t('emptyBody')}
            action={
              activeCount ? (
                <Button
                  variant="secondary"
                  onClick={() => update({ ...EMPTY, sort: filters.sort })}
                >
                  {tc('clear')}
                </Button>
              ) : undefined
            }
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
              saveFilters.mutate(
                [...saved, { name: saveName.trim().slice(0, 40), query: filters }],
                {
                  onSuccess: () => {
                    setSaveOpen(false);
                    setSaveName('');
                    toast(tc('saved'));
                  },
                },
              )
            }
          >
            {tc('save')}
          </Button>
        }
      >
        <Field label={t('filterName')}>
          {({ id }) => (
            <Input
              id={id}
              maxLength={40}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              autoFocus
            />
          )}
        </Field>
      </Modal>
    </Stack>
  );
}
