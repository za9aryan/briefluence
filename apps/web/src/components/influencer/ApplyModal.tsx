'use client';
import { CURRENCY_SYMBOL, PITCH_MAX_LENGTH, toMinor } from '@briefluence/shared';
import { Alert, Button, Field, Input, Modal, Stack, Text, Textarea, cn } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON } from '@/lib/hooks/options';
import type { DealDetailDto } from '@/lib/types';
import { Icon, ScoreMeter } from '@briefluence/ui';

export function ApplyModal({ deal, open, onClose, onApplied }: { deal: DealDetailDto; open: boolean; onClose: () => void; onApplied: () => void }) {
  const t = useTranslations('deals.apply');
  const tc = useTranslations('common');
  const f = useFormat();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const accounts = deal.eligibleAccounts ?? [];
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [pitch, setPitch] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const paid = deal.paymentType !== 'BARTER';

  const apply = useMutation({
    mutationFn: () =>
      api.post(`/deals/${deal.id}/applications`, {
        socialAccountId: accountId,
        pitch: pitch.trim(),
        proposedPrice: paid && price ? toMinor(Number(price)) : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['applications'] });
      onApplied();
    },
    onError: (e) => setError(errorMessage(e)),
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
          <Button disabled={!accountId || !pitchOk} loading={apply.isPending} onClick={() => apply.mutate()}>
            {t('send')}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        {error && <Alert tone="danger">{error}</Alert>}
        <fieldset>
          <legend className="mb-2 text-small font-bold text-ink">{t('account')}</legend>
          <div role="radiogroup" className="flex flex-col gap-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accountId === a.id}
                onClick={() => setAccountId(a.id)}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-2 rounded-card border-2 px-4 py-2 text-left',
                  accountId === a.id ? 'border-primary bg-primary-soft' : 'border-line hover:border-primary/40',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon name={PLATFORM_ICON[a.platform]} />
                  <span className="text-body font-bold text-ink">@{a.username}</span>
                  <span className="text-small text-ink-muted">{f.compact(a.followers)}</span>
                </span>
                {a.score != null && <ScoreMeter size="sm" value={a.score} label={t('match')} />}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t('pitch')} hint={t('pitchHint')} aside={`${pitch.length}/${PITCH_MAX_LENGTH}`} required>
          {({ id, describedBy }) => (
            <Textarea id={id} aria-describedby={describedBy} rows={5} maxLength={PITCH_MAX_LENGTH} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={t('pitchPlaceholder')} />
          )}
        </Field>
        {paid && (
          <Field
            label={t('price')}
            hint={price && deal.currency !== f.displayCurrency ? `${f.display(toMinor(Number(price)), deal.currency).main} · ${t('priceHint')}` : t('priceHint')}
            aside={tc('optional')}
          >
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} type="number" inputMode="numeric" min={0} suffix={CURRENCY_SYMBOL[deal.currency]} value={price} onChange={(e) => setPrice(e.target.value)} />
            )}
          </Field>
        )}
        <Text size="small" tone="muted">
          {t('contactsNote')}
        </Text>
      </Stack>
    </Modal>
  );
}
