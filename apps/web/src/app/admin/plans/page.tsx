'use client';
import { CURRENCIES, type Currency, type PlanCode } from '@briefluence/shared';
import {
  Button,
  Card,
  Field,
  FieldGrid,
  Inline,
  Input,
  Select,
  Skeleton,
  Stack,
  Switch,
  Text,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';

interface PlanRow {
  code: PlanCode;
  priceMinor: number;
  currency: Currency;
  applicationLimit: number | null;
  offerLimit: number | null;
  isActive: boolean;
}

/** One plan's settings. Prices are typed in major units (9.99) and stored in minor units. */
function PlanEditor({ plan }: { plan: PlanRow }) {
  const t = useTranslations('admin.plans');
  const tn = useTranslations('billing.plans.name');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const basic = plan.code === 'BASIC';
  const [price, setPrice] = useState(String(plan.priceMinor / 100));
  const [currency, setCurrency] = useState<Currency>(plan.currency);
  const [limit, setLimit] = useState(String(plan.applicationLimit ?? 10));
  const [offers, setOffers] = useState(String(plan.offerLimit ?? 1));
  const [active, setActive] = useState(plan.isActive);
  const save = useMutation({
    mutationFn: () =>
      api.patch(`/admin/plans/${plan.code}`, {
        priceMinor: basic ? 0 : Math.round(Number(price) * 100),
        currency,
        applicationLimit: basic ? Math.round(Number(limit)) : null,
        offerLimit: basic ? Math.round(Number(offers)) : null,
        isActive: basic ? true : active,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      toast(t('saved'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const valid = basic ? Number(limit) >= 1 && Number(offers) >= 0 : Number(price) > 0;

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <Stack gap={4}>
          <Inline justify="between" align="center" wrap>
            <Text weight="bold" size="body">
              {tn(plan.code)}
            </Text>
            {!basic && <Switch checked={active} onChange={setActive} label={t('active')} />}
          </Inline>
          <FieldGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Field label={t('price')}>
              {({ id }) =>
                basic ? (
                  <Input id={id} value={t('free')} disabled />
                ) : (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                )
              }
            </Field>
            <Field label={t('currency')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  disabled={basic}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('limit')}>
              {({ id }) =>
                basic ? (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                ) : (
                  <Input id={id} value={t('unlimited')} disabled />
                )
              }
            </Field>
            <Field label={t('offerLimit')}>
              {({ id }) =>
                basic ? (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={offers}
                    onChange={(e) => setOffers(e.target.value)}
                  />
                ) : (
                  <Input id={id} value={t('unlimitedOffers')} disabled />
                )
              }
            </Field>
          </FieldGrid>
          <Inline justify="end">
            <Button type="submit" disabled={!valid} loading={save.isPending}>
              {t('save')}
            </Button>
          </Inline>
        </Stack>
      </form>
    </Card>
  );
}

export default function AdminPlansPage() {
  const t = useTranslations('admin.plans');
  const plans = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get<PlanRow[]>('/admin/plans'),
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      {!plans.data ? (
        <Skeleton className="h-64 rounded-card" />
      ) : (
        <Stack gap={4}>
          {plans.data.map((p) => (
            <PlanEditor
              key={`${p.code}-${p.priceMinor}-${p.currency}-${p.applicationLimit}-${p.offerLimit}-${p.isActive}`}
              plan={p}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
