'use client';
import type { Currency, PaymentType } from '@briefluence/shared';
import { Badge, Inline, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/lib/hooks/format';

/**
 * Money range and/or barter offer, converted into the viewer's currency (original shown next to it).
 * Barter uses the `sun` badge (brand: barter & rewards only).
 */
export function Compensation({
  paymentType,
  budgetMin,
  budgetMax,
  currency,
  barterDescription,
  compact,
}: {
  paymentType: PaymentType;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: Currency;
  barterDescription: string | null;
  compact?: boolean;
}) {
  const t = useTranslations('enums.paymentType');
  const f = useFormat();
  const money = paymentType !== 'BARTER' ? f.displayRange(budgetMin, budgetMax, currency) : null;
  return (
    <Inline gap={2} wrap>
      {paymentType !== 'MONEY' && <Badge tone="barter">{t('BARTER')}</Badge>}
      {money && (
        <Text as="span" weight="bold">
          {money.main}
        </Text>
      )}
      {money?.original && (
        <Text as="span" size="small" tone="muted">
          ({money.original})
        </Text>
      )}
      {!compact && paymentType !== 'MONEY' && barterDescription && (
        <Text as="span" size="small" tone="muted">
          {barterDescription}
        </Text>
      )}
    </Inline>
  );
}

/** One amount in the viewer's currency, with the original in brackets when converted. */
export function Money({ minor, currency }: { minor: number; currency: Currency }) {
  const f = useFormat();
  const d = f.display(minor, currency);
  return (
    <>
      {d.main}
      {d.original && <span className="text-ink-muted"> ({d.original})</span>}
    </>
  );
}
