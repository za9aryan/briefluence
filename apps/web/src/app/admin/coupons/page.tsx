'use client';
import type { CouponCreateInput } from '@briefluence/shared';
import {
  Alert,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  FieldGrid,
  Grid,
  Inline,
  Input,
  Modal,
  Skeleton,
  Stack,
  Stat,
  Text,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import {
  type AdminCoupon,
  CouponStateBadge,
  useCouponGives,
  useCouponUses,
} from '@/components/admin/coupons';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

const KEY = ['admin', 'coupons'];

type ProPlan = CouponCreateInput['plans'][number];

/** Readable random code without look-alike characters (0/O, 1/I). */
function randomCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

/** New coupon: free Pro months or a discount, how many uses, optional code / last day / note. */
function CreateCouponModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('admin.coupons.form');
  const tc = useTranslations('admin.coupons');
  const tn = useTranslations('billing.plans.name');
  const tcommon = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [kind, setKind] = useState<'free' | 'discount'>('free');
  const [months, setMonths] = useState('1');
  const [percent, setPercent] = useState('50');
  const [periods, setPeriods] = useState('3');
  const [forever, setForever] = useState(false);
  const [plans, setPlans] = useState<ProPlan[]>(['PRO_MONTHLY', 'PRO_YEARLY']);
  const [code, setCode] = useState('');
  const [uses, setUses] = useState<'one' | 'limited' | 'unlimited'>('one');
  const [usesCount, setUsesCount] = useState('100');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');

  const int = (v: string) => (/^\d+$/.test(v) ? Number(v) : NaN);
  const body: CouponCreateInput = {
    ...(code.trim() ? { code: code.trim() } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
    percentOff: kind === 'free' ? 100 : int(percent),
    billingPeriods: kind === 'free' ? int(months) : forever ? null : int(periods),
    plans: kind === 'free' ? ['PRO_MONTHLY'] : plans,
    maxUses: uses === 'one' ? 1 : uses === 'unlimited' ? null : int(usesCount),
    // The last day counts in full: the coupon ends at the end of that day (Yerevan, UTC+4).
    expiresAt: expires ? new Date(`${expires}T23:59:59+04:00`).toISOString() : null,
  };
  const valid =
    (!code.trim() || /^[A-Za-z0-9]{3,32}$/.test(code.trim())) &&
    body.percentOff >= 1 &&
    body.percentOff <= (kind === 'free' ? 100 : 99) &&
    (body.billingPeriods === null || (body.billingPeriods >= 1 && body.billingPeriods <= 36)) &&
    body.plans.length > 0 &&
    (body.maxUses === null || (body.maxUses >= 1 && body.maxUses <= 100_000));

  const create = useMutation({
    mutationFn: () => api.post<AdminCoupon>('/admin/coupons', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast(tc('created'));
      onClose();
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      closeLabel={tcommon('close')}
      title={tc('create')}
      description={t('summary')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tcommon('back')}
          </Button>
          <Button
            icon="gift"
            disabled={!valid}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {t('submit')}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        <Field label={t('kind')}>
          {({ id }) => (
            <ChipGroup
              aria-label={t('kind')}
              value={kind}
              onChange={(v) => setKind(v)}
              options={[
                { value: 'free', label: t('kindFree'), icon: 'sparkles' },
                { value: 'discount', label: t('kindDiscount'), icon: 'gift' },
              ]}
              aria-describedby={id}
            />
          )}
        </Field>
        {kind === 'free' ? (
          <Field label={t('months')} hint={t('monthsHint')}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="number"
                inputMode="numeric"
                min={1}
                max={36}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            )}
          </Field>
        ) : (
          <>
            <FieldGrid cols={{ base: 1, sm: 2 }}>
              <Field label={t('percent')}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('periods')} hint={t('periodsHint')}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={36}
                    disabled={forever}
                    value={forever ? '' : periods}
                    onChange={(e) => setPeriods(e.target.value)}
                  />
                )}
              </Field>
            </FieldGrid>
            <ChipGroup
              aria-label={t('periods')}
              multiple
              value={forever ? ['forever'] : []}
              onChange={(v) => setForever(v.includes('forever'))}
              options={[{ value: 'forever', label: t('forever') }]}
            />
            <Field label={t('plans')}>
              {() => (
                <ChipGroup
                  aria-label={t('plans')}
                  multiple
                  value={plans}
                  onChange={setPlans}
                  invalid={!plans.length}
                  options={(['PRO_MONTHLY', 'PRO_YEARLY'] as const).map((p) => ({
                    value: p,
                    label: tn(p),
                  }))}
                />
              )}
            </Field>
          </>
        )}
        <Field label={t('uses')} hint={t('usesHint')}>
          {({ describedBy }) => (
            <ChipGroup
              aria-label={t('uses')}
              aria-describedby={describedBy}
              value={uses}
              onChange={setUses}
              options={[
                { value: 'one', label: t('usesOne') },
                { value: 'limited', label: t('usesLimited') },
                { value: 'unlimited', label: t('usesUnlimited') },
              ]}
            />
          )}
        </Field>
        {uses === 'limited' && (
          <Field label={t('usesCount')}>
            {({ id }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                value={usesCount}
                onChange={(e) => setUsesCount(e.target.value)}
              />
            )}
          </Field>
        )}
        <FieldGrid cols={{ base: 1, sm: 2 }}>
          <Field label={t('code')} hint={t('codeHint')}>
            {({ id, describedBy }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={code}
                  maxLength={32}
                  autoComplete="off"
                  className="font-mono uppercase"
                  onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
                />
                <Button variant="secondary" icon="refresh" onClick={() => setCode(randomCode())}>
                  {t('generate')}
                </Button>
              </div>
            )}
          </Field>
          <Field label={t('expires')}>
            {({ id }) => (
              <Input
                id={id}
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            )}
          </Field>
        </FieldGrid>
        <Field label={t('note')}>
          {({ id }) => (
            <Input
              id={id}
              maxLength={200}
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      </Stack>
    </Modal>
  );
}

function CouponRow({ c }: { c: AdminCoupon }) {
  const t = useTranslations('admin.coupons');
  const tn = useTranslations('billing.plans.name');
  const f = useFormat();
  const gives = useCouponGives();
  const usesText = useCouponUses();
  return (
    <Link
      href={`/admin/coupons/${c.id}`}
      className="block rounded-card focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Card className="transition-colors hover:border-primary/40">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center">
          <Stack gap={1} className="min-w-0">
            <Inline gap={2} wrap>
              <Text weight="bold" className="font-mono text-body">
                {c.code}
              </Text>
              <CouponStateBadge state={c.state} />
            </Inline>
            <Text size="small" tone="muted" truncate>
              {gives(c)} · {c.plans.map((p) => tn(p)).join(', ')}
              {c.note ? ` · ${c.note}` : ''}
            </Text>
          </Stack>
          <Stack gap={1}>
            <Text size="small" weight="bold" className="tabular-nums">
              {c.maxUses === 1 && c.stats.uses === 0 ? t('singleUse') : usesText(c)}
            </Text>
            <Text size="small" tone="muted">
              {c.expiresAt ? t('expires', { date: f.date(c.expiresAt) }) : t('noExpiry')}
            </Text>
          </Stack>
          <Inline gap={4} className="md:justify-end">
            <Stack gap={0} className="md:text-right">
              <Text size="small" tone="muted">
                {t('stats.conversion')}
              </Text>
              <Text weight="bold" className="tabular-nums">
                {c.stats.uses ? `${c.stats.conversion}%` : '—'}
              </Text>
            </Stack>
          </Inline>
        </div>
      </Card>
    </Link>
  );
}

export default function AdminCouponsPage() {
  const t = useTranslations('admin.coupons');
  const [creating, setCreating] = useState(false);
  const list = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<{ enabled: boolean; coupons: AdminCoupon[] }>('/admin/coupons'),
  });
  const coupons = list.data?.coupons ?? [];
  const total = coupons.reduce(
    (a, c) => ({ uses: a.uses + c.stats.uses, paying: a.paying + c.stats.paying }),
    { uses: 0, paying: 0 },
  );
  const canCreate = !!list.data?.enabled;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('title')}
        description={t('lead')}
        actions={
          canCreate ? (
            <Button icon="plus" onClick={() => setCreating(true)}>
              {t('create')}
            </Button>
          ) : undefined
        }
      />
      {list.data && !list.data.enabled && <Alert tone="info">{t('disabled')}</Alert>}
      {!list.data ? (
        <Skeleton className="h-64 rounded-card" />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon="gift"
          title={t('empty')}
          description={t('emptyBody')}
          action={
            canCreate ? (
              <Button icon="plus" onClick={() => setCreating(true)}>
                {t('create')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Grid cols={{ base: 2, lg: 4 }} gap={4}>
            <Stat label={t('stats.coupons')} value={coupons.length} icon="gift" />
            <Stat label={t('stats.uses')} value={total.uses} icon="users" />
            <Stat label={t('stats.paying')} value={total.paying} icon="wallet" />
            <Stat
              label={t('stats.conversion')}
              value={total.uses ? `${Math.round((total.paying / total.uses) * 100)}%` : '—'}
              icon="trend"
            />
          </Grid>
          <Stack gap={2}>
            {coupons.map((c) => (
              <CouponRow key={c.id} c={c} />
            ))}
          </Stack>
        </>
      )}
      {/* Remounted on every open so the form starts empty. */}
      {creating && <CreateCouponModal open onClose={() => setCreating(false)} />}
    </Stack>
  );
}
