'use client';
import {
  APPLICATION_PORTFOLIO_MAX,
  CURRENCY_SYMBOL,
  PITCH_MAX_LENGTH,
  isPortfolioVisible,
  toMinor,
} from '@briefluence/shared';
import {
  Alert,
  Button,
  Field,
  Icon,
  Input,
  Modal,
  Stack,
  Text,
  Textarea,
  cn,
} from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { usePortfolio } from '@/components/influencer/PortfolioSettings';
import { ApiError, api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { DealDetailDto, PortfolioItemDto } from '@/lib/types';

export function ApplyModal({
  deal,
  open,
  onClose,
  onApplied,
  onLimit,
}: {
  deal: DealDetailDto;
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
  /** Basic plan limit reached: the page shows the upgrade message instead of an error. */
  onLimit?: (limit: number | null) => void;
}) {
  const t = useTranslations('deals.apply');
  const tc = useTranslations('common');
  const f = useFormat();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [pitch, setPitch] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const portfolio = usePortfolio();
  const approved = (portfolio.data ?? []).filter(isPortfolioVisible);
  const waiting = (portfolio.data ?? []).some((i) => i.reviewStatus === 'PENDING');
  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id)
        ? p.filter((x) => x !== id)
        : p.length < APPLICATION_PORTFOLIO_MAX
          ? [...p, id]
          : p,
    );
  const paid = deal.paymentType !== 'BARTER';

  const apply = useMutation({
    mutationFn: () =>
      api.post(`/deals/${deal.id}/applications`, {
        pitch: pitch.trim(),
        proposedPrice: paid && price ? toMinor(Number(price)) : null,
        portfolioItemIds: picked,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['applications'] });
      onApplied();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'APPLICATION_LIMIT_REACHED' && onLimit) {
        onLimit((e.details as { limit?: number | null } | undefined)?.limit ?? null);
        return;
      }
      setError(errorMessage(e));
    },
  });
  const pitchOk = pitch.trim().length >= 10;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('title')}
      description={deal.title}
      closeLabel={tc('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button disabled={!pitchOk} loading={apply.isPending} onClick={() => apply.mutate()}>
            {t('send')}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field
          label={t('pitch')}
          hint={t('pitchHint')}
          aside={`${pitch.length}/${PITCH_MAX_LENGTH}`}
          required
        >
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              rows={5}
              maxLength={PITCH_MAX_LENGTH}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder={t('pitchPlaceholder')}
            />
          )}
        </Field>
        {paid && (
          <Field
            label={t('price')}
            hint={
              price && deal.currency !== f.displayCurrency
                ? `${f.display(toMinor(Number(price)), deal.currency).main} · ${t('priceHint')}`
                : t('priceHint')
            }
            aside={tc('optional')}
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                inputMode="numeric"
                min={0}
                suffix={CURRENCY_SYMBOL[deal.currency]}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            )}
          </Field>
        )}
        <PortfolioPicker
          items={approved}
          picked={picked}
          waiting={waiting}
          loading={portfolio.isLoading}
          onToggle={toggle}
        />
        <Text size="small" tone="muted">
          {t('contactsNote')}
        </Text>
      </Stack>
    </Modal>
  );
}

/** Optional: attach up to three approved portfolio items to the application. */
function PortfolioPicker({
  items,
  picked,
  waiting,
  loading,
  onToggle,
}: {
  items: PortfolioItemDto[];
  picked: string[];
  waiting: boolean;
  loading: boolean;
  onToggle: (id: string) => void;
}) {
  const t = useTranslations('portfolio.apply');
  if (loading) return null;
  const full = picked.length >= APPLICATION_PORTFOLIO_MAX;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-small font-bold text-ink">{t('title')}</legend>
      {items.length ? (
        <>
          <Text size="small" tone="muted">
            {t('hint', { max: APPLICATION_PORTFOLIO_MAX })}
          </Text>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((i) => {
              const on = picked.includes(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={i.title}
                  disabled={!on && full}
                  onClick={() => onToggle(i.id)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-card border-2 transition-colors disabled:opacity-40',
                    on ? 'border-primary' : 'border-line hover:border-primary/40',
                  )}
                >
                  <img src={i.imageUrl} alt="" className="size-full object-cover" />
                  {on && (
                    <span className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-pill bg-primary text-on-primary">
                      <Icon name="check" size="xs" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {waiting && (
            <Text size="small" tone="muted">
              {t('pendingNote')}
            </Text>
          )}
        </>
      ) : (
        <Text size="small" tone="muted">
          {waiting ? t('pendingNote') : t('none')}{' '}
          <Link
            href="/influencer/account#portfolio"
            className="font-bold text-primary-text hover:underline"
          >
            {t('openSettings')}
          </Link>
        </Text>
      )}
    </fieldset>
  );
}
