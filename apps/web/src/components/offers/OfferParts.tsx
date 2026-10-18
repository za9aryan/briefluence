'use client';
import {
  CURRENCIES,
  offerInputSchema,
  type CollaborationType,
  type ContentFormat,
  type Currency,
  type OfferInput,
  type OfferRequestStatus,
  type OfferStatus,
  type Platform,
} from '@briefluence/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  ChipGroup,
  Field,
  FieldGrid,
  Icon,
  Inline,
  Input,
  Select,
  Stack,
  Text,
  Textarea,
  type BadgeTone,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { CollaborationBadge } from '@/components/domain/badges';
import { useFieldError } from '@/components/forms/form';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON, useOptions } from '@/lib/hooks/options';
import type { FeedOfferDto, OfferDto } from '@/lib/types';

const STATUS_TONE: Record<OfferStatus, BadgeTone> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'primary',
  REJECTED: 'danger',
  ACTIVE: 'success',
  PAUSED: 'primary',
  CLOSED: 'ink',
};
const REQUEST_TONE: Record<OfferRequestStatus, BadgeTone> = {
  PENDING: 'primary',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  WITHDRAWN: 'neutral',
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const t = useTranslations('offers.status');
  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}

export function OfferRequestBadge({ status }: { status: OfferRequestStatus }) {
  const t = useTranslations('offers.requestStatus');
  return <Badge tone={REQUEST_TONE[status]}>{t(status)}</Badge>;
}

/** "AMD 10,000" (with the viewer's currency next to it) or "Price on request". */
export function OfferPrice({
  offer,
  size = 'h2',
}: {
  offer: Pick<OfferDto, 'priceMinor' | 'currency'>;
  size?: 'h2' | 'body';
}) {
  const t = useTranslations('offers.fields');
  const f = useFormat();
  if (offer.priceMinor == null) return <Text weight="bold">{t('priceOnRequest')}</Text>;
  const d = f.display(offer.priceMinor, offer.currency);
  return (
    <Inline gap={2} align="baseline" wrap>
      <span className={size === 'h2' ? 'text-h2 font-extrabold text-ink' : 'font-bold text-ink'}>
        {d.main}
      </span>
      {d.original && (
        <Text size="small" tone="muted">
          {d.original}
        </Text>
      )}
    </Inline>
  );
}

/** Formats and platforms as one muted line: "Story, Reel · Instagram". */
export function OfferMeta({ offer }: { offer: Pick<OfferDto, 'contentFormats' | 'platforms'> }) {
  const te = useTranslations('enums');
  return (
    <Inline gap={2} wrap>
      {offer.platforms.map((p) => (
        <Icon key={p} name={PLATFORM_ICON[p]} tone="muted" label={te(`platform.${p}`)} />
      ))}
      <Text as="span" size="small" tone="muted">
        {offer.contentFormats.map((x) => te(`contentFormat.${x}`)).join(', ')}
      </Text>
    </Inline>
  );
}

/** Offer card in the brand feed. */
export function OfferCard({ offer, href }: { offer: FeedOfferDto; href: string }) {
  const t = useTranslations('offers');
  const f = useFormat();
  const top = offer.blogger.socialAccounts[0];
  return (
    <Card className="flex h-full flex-col">
      <Stack gap={4} className="flex-1">
        <Inline gap={2} justify="between" align="start">
          <Inline gap={2} align="center" className="min-w-0">
            <Avatar name={offer.blogger.displayName} src={offer.blogger.avatarUrl} size="sm" />
            <Stack gap={0} className="min-w-0">
              <Text weight="bold" truncate>
                {offer.blogger.displayName}
                {offer.blogger.verified && (
                  <Icon name="verified" tone="success" className="ml-1 inline" />
                )}
              </Text>
              {top && (
                <Text size="small" tone="muted" truncate>
                  @{top.username} · {f.compact(top.followers)}
                </Text>
              )}
            </Stack>
          </Inline>
          <CollaborationBadge type={offer.collaborationType} />
        </Inline>
        <Link href={href} className="text-h2 font-bold text-ink hover:text-primary-text">
          {offer.title}
        </Link>
        <Text size="small" tone="muted" className="line-clamp-3">
          {offer.description}
        </Text>
        {offer.idealBrands && (
          <Text size="small">
            <Icon name="target" tone="accent" className="mr-1 inline" />
            {t('wantsToWorkWith', { value: offer.idealBrands })}
          </Text>
        )}
        <OfferMeta offer={offer} />
      </Stack>
      <Inline gap={2} justify="between" align="center" className="mt-4 border-t border-line pt-4">
        <OfferPrice offer={offer} size="body" />
        <Inline gap={2} align="center">
          <Text size="small" tone="muted">
            {t('views', { count: offer.viewCount })}
          </Text>
          {offer.myRequest ? <OfferRequestBadge status={offer.myRequest.status} /> : null}
        </Inline>
      </Inline>
    </Card>
  );
}

export type OfferFormValues = OfferInput;

export const EMPTY_OFFER: OfferFormValues = {
  title: '',
  description: '',
  priceMinor: null,
  currency: 'AMD',
  collaborationType: 'ONE_TIME',
  platforms: [],
  contentFormats: [],
  niches: [],
  idealBrands: null,
};

/** Create / edit form. Prices are typed in major units; "price on request" sends null. */
export function OfferForm({
  initial,
  busy,
  error,
  onSubmit,
  footerNote,
}: {
  initial: OfferFormValues;
  busy: 'draft' | 'publish' | null;
  error?: ReactNode;
  onSubmit: (values: OfferFormValues, publish: boolean) => void;
  footerNote?: ReactNode;
}) {
  const t = useTranslations('offers');
  const tc = useTranslations('common');
  const o = useOptions();
  const fe = useFieldError();
  const [v, setV] = useState<OfferFormValues>(initial);
  const [onRequest, setOnRequest] = useState(initial.priceMinor == null && initial.title !== '');
  const [price, setPrice] = useState(
    initial.priceMinor != null ? String(initial.priceMinor / 100) : '',
  );
  const [errors, setErrors] = useState<Record<string, { type: string; message?: string }>>({});
  const set = <K extends keyof OfferFormValues>(k: K, value: OfferFormValues[K]) =>
    setV((s) => ({ ...s, [k]: value }));
  const err = (k: string) => fe(errors[k] as never);

  const submit = (publish: boolean) => {
    const parsed = offerInputSchema.safeParse({
      ...v,
      priceMinor: onRequest || price === '' ? null : Math.round(Number(price) * 100),
    });
    if (!parsed.success) {
      const next: Record<string, { type: string; message?: string }> = {};
      for (const i of parsed.error.issues)
        next[String(i.path[0])] ??= { type: i.code, message: i.message };
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data, publish);
  };

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
      >
        <Stack gap={6}>
          {error}
          <Field
            label={t('fields.title')}
            hint={t('fields.titleHint')}
            error={err('title')}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                maxLength={120}
                value={v.title}
                onChange={(e) => set('title', e.target.value)}
              />
            )}
          </Field>
          <Field
            label={t('fields.description')}
            hint={t('fields.descriptionHint')}
            error={err('description')}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                rows={5}
                maxLength={3000}
                value={v.description}
                onChange={(e) => set('description', e.target.value)}
              />
            )}
          </Field>
          <FieldGrid cols={{ base: 1, sm: 2 }}>
            <Field label={t('fields.price')} error={err('priceMinor')}>
              {({ id, invalid }) => (
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  invalid={invalid}
                  disabled={onRequest}
                  value={onRequest ? '' : price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              )}
            </Field>
            <Field label={t('fields.currency')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={v.currency}
                  disabled={onRequest}
                  onChange={(e) => set('currency', e.target.value as Currency)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FieldGrid>
          <Checkbox
            checked={onRequest}
            onChange={(e) => setOnRequest(e.target.checked)}
            label={t('fields.priceOnRequest')}
          />
          <Field label={t('fields.collaboration')}>
            {() => (
              <ChipGroup
                options={o.collaboration}
                value={v.collaborationType}
                onChange={(x: CollaborationType) => set('collaborationType', x)}
              />
            )}
          </Field>
          <Field label={t('fields.platforms')} error={err('platforms')} required>
            {({ invalid }) => (
              <ChipGroup
                multiple
                options={o.platforms}
                value={v.platforms}
                onChange={(x: Platform[]) => set('platforms', x)}
                invalid={invalid}
              />
            )}
          </Field>
          <Field label={t('fields.formats')} error={err('contentFormats')} required>
            {({ invalid }) => (
              <ChipGroup
                multiple
                options={o.formats}
                value={v.contentFormats}
                onChange={(x: ContentFormat[]) => set('contentFormats', x)}
                invalid={invalid}
              />
            )}
          </Field>
          <Field label={t('fields.niches')} aside={tc('optional')}>
            {() => (
              <ChipGroup
                multiple
                options={o.niches}
                value={v.niches as string[]}
                onChange={(x: string[]) => set('niches', x as OfferFormValues['niches'])}
              />
            )}
          </Field>
          <Field
            label={t('fields.idealBrands')}
            hint={t('fields.idealBrandsHint')}
            aside={tc('optional')}
            error={err('idealBrands')}
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                maxLength={200}
                value={v.idealBrands ?? ''}
                onChange={(e) => set('idealBrands', e.target.value || null)}
              />
            )}
          </Field>
          <Stack gap={2}>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                loading={busy === 'draft'}
                disabled={!!busy}
                onClick={() => submit(false)}
              >
                {t('saveDraft')}
              </Button>
              <Button type="submit" loading={busy === 'publish'} disabled={!!busy}>
                {t('publish')}
              </Button>
            </div>
            {footerNote && (
              <Text size="small" tone="muted" className="sm:text-right">
                {footerNote}
              </Text>
            )}
          </Stack>
        </Stack>
      </form>
    </Card>
  );
}
