'use client';
import { CURRENCY_SYMBOL, PITCH_MAX_LENGTH, toMinor } from '@briefluence/shared';
import { Alert, Button, Field, Input, Modal, Stack, Text, Textarea } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { DealDetailDto } from '@/lib/types';

export function ApplyModal({ deal, open, onClose, onApplied }: { deal: DealDetailDto; open: boolean; onClose: () => void; onApplied: () => void }) {
  const t = useTranslations('deals.apply');
  const tc = useTranslations('common');
  const f = useFormat();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [pitch, setPitch] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const paid = deal.paymentType !== 'BARTER';

  const apply = useMutation({
    mutationFn: () =>
      api.post(`/deals/${deal.id}/applications`, {
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
          <Button disabled={!pitchOk} loading={apply.isPending} onClick={() => apply.mutate()}>
            {t('send')}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        {error && <Alert tone="danger">{error}</Alert>}
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
