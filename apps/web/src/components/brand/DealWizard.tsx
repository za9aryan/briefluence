'use client';
import {
  AUDIENCE_SIZE_PRESETS,
  CURRENCIES,
  CURRENCY_SYMBOL,
  INFLUENCER_AGE_RANGE,
  dealInputSchema,
  type AudienceSizePreset,
  type GenderFilter,
  type PaymentType,
} from '@briefluence/shared';
import {
  Alert,
  Button,
  Card,
  ChipGroup,
  DescriptionList,
  Field,
  FieldGrid,
  Heading,
  Input,
  RangeInput,
  Select,
  Slider,
  Stack,
  Stepper,
  Text,
  Textarea,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Controller, useForm, type FieldErrors, type Path, type Resolver } from 'react-hook-form';
import { ImageUpload } from '@/components/forms/ImageUpload';
import { useFieldError } from '@/components/forms/form';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import { presetOf, toDealInput, type DealFormValues } from './deal-form-values';
import { ReachCounter } from './ReachCounter';

/** Validates the wizard state with the shared Zod schema (after unit conversion). */
const resolver: Resolver<DealFormValues> = async (values) => {
  const parsed = dealInputSchema.safeParse(toDealInput(values));
  if (parsed.success) return { values, errors: {} };
  const errors: Record<string, { type: string; message: string }> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'root');
    errors[key] ??= { type: issue.code, message: issue.message };
  }
  return { values: {}, errors: errors as FieldErrors<DealFormValues> };
};

const STEP_FIELDS: Path<DealFormValues>[][] = [
  ['title', 'description', 'platforms', 'contentFormats', 'niches', 'imageUrl'],
  ['countries', 'cities', 'minFollowers', 'maxFollowers', 'influencerAgeMax', 'audienceAgeMax', 'languages'],
  ['paymentType', 'budgetMin', 'budgetMax', 'barterDescription', 'barterValue', 'slots', 'applicationDeadline', 'publishBy'],
  [],
];

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Stack gap={1}>
        <Heading level={3}>{title}</Heading>
        {hint && (
          <Text size="small" tone="muted">
            {hint}
          </Text>
        )}
      </Stack>
      {children}
    </Stack>
  );
}

export function DealWizard({
  initial,
  submitting,
  serverError,
  onSubmit,
}: {
  initial: DealFormValues;
  submitting: 'draft' | 'publish' | null;
  serverError: string | null;
  onSubmit: (values: DealFormValues, publish: boolean) => void;
}) {
  const t = useTranslations('dealForm');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const fe = useFieldError();
  const f = useFormat();
  const o = useOptions();
  const [step, setStep] = useState(0);
  const form = useForm<DealFormValues>({ resolver, defaultValues: initial, mode: 'onTouched' });
  const { errors } = form.formState;
  const v = form.watch();
  const [preset, setPreset] = useState<AudienceSizePreset | 'custom' | null>(presetOf(initial.minFollowers, initial.maxFollowers));

  const steps = [t('steps.basics'), t('steps.targeting'), t('steps.compensation'), t('steps.review')];
  const next = async () => {
    if (await form.trigger(STEP_FIELDS[step])) {
      setStep((s) => Math.min(s + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const submit = (publish: boolean) => form.handleSubmit((values) => onSubmit(values, publish), () => setStep(0))();

  const genderOptions = (kind: 'genderFilter' | 'audienceGender') =>
    (['ANY', 'FEMALE', 'MALE'] as GenderFilter[]).map((g) => ({ value: g, label: te(`${kind}.${g}`) }));
  const money = v.paymentType !== 'BARTER';
  const barter = v.paymentType !== 'MONEY';
  const curSymbol = CURRENCY_SYMBOL[v.currency ?? 'AMD'];
  const range = (min: number | null | undefined, max: number | null | undefined, fmt: (n: number) => string = String) =>
    min == null && max == null ? tc('any') : `${min != null ? fmt(min) : '…'} – ${max != null ? fmt(max) : '…'}`;

  const targeting = {
    platforms: v.platforms,
    niches: v.niches,
    countries: v.countries,
    cities: v.cities,
    languages: v.languages,
    minFollowers: v.minFollowers,
    maxFollowers: v.maxFollowers,
    minEngagementRate: v.minEngagementRate,
    influencerGender: v.influencerGender,
    influencerAgeMin: v.influencerAgeMin,
    influencerAgeMax: v.influencerAgeMax,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Stack gap={6} className="min-w-0">
        <Stepper steps={steps} current={step} onSelect={setStep} />
        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <Card>
          {step === 0 && (
            <Stack gap={8}>
              <Section title={t('basics.title')} hint={t('basics.hint')}>
                <Field label={t('fields.title')} error={fe(errors.title)} hint={t('fields.titleHint')} required>
                  {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} maxLength={120} {...form.register('title')} />}
                </Field>
                <Field label={t('fields.description')} error={fe(errors.description)} hint={t('fields.descriptionHint')} required>
                  {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={6} maxLength={5000} {...form.register('description')} />}
                </Field>
                <Controller
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => <ImageUpload wide kind="deal" label={t('fields.cover')} name="" value={field.value} onChange={field.onChange} />}
                />
              </Section>
              <Controller
                control={form.control}
                name="platforms"
                render={({ field }) => (
                  <Field label={t('fields.platforms')} error={fe(errors.platforms as never)} required>
                    {({ invalid }) => <ChipGroup multiple options={o.platforms} value={field.value ?? []} onChange={field.onChange} invalid={invalid} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="contentFormats"
                render={({ field }) => (
                  <Field label={t('fields.formats')} error={fe(errors.contentFormats as never)} required>
                    {({ invalid }) => <ChipGroup multiple options={o.formats} value={field.value ?? []} onChange={field.onChange} invalid={invalid} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="niches"
                render={({ field }) => (
                  <Field label={t('fields.niches')} aside={tc('optional')}>
                    {() => <ChipGroup multiple options={o.niches} value={(field.value ?? []) as string[]} onChange={field.onChange} />}
                  </Field>
                )}
              />
            </Stack>
          )}

          {step === 1 && (
            <Stack gap={8}>
              <Section title={t('targeting.where')}>
                <Controller
                  control={form.control}
                  name="countries"
                  render={({ field }) => (
                    <Field label={t('fields.countries')} error={fe(errors.countries as never)} required>
                      {({ invalid }) => (
                        <ChipGroup
                          multiple
                          options={o.countries}
                          value={field.value ?? []}
                          onChange={(c) => {
                            field.onChange(c);
                            const allowed = new Set(o.citiesOf(c).map((x) => x.value));
                            form.setValue('cities', (form.getValues('cities') ?? []).filter((x) => allowed.has(x)));
                          }}
                          invalid={invalid}
                        />
                      )}
                    </Field>
                  )}
                />
                {o.citiesOf(v.countries ?? []).length > 0 && (
                  <Controller
                    control={form.control}
                    name="cities"
                    render={({ field }) => (
                      <Field label={t('fields.cities')} hint={t('fields.citiesHint')}>
                        {() => <ChipGroup multiple options={o.citiesOf(v.countries ?? [])} value={field.value ?? []} onChange={field.onChange} />}
                      </Field>
                    )}
                  />
                )}
              </Section>

              <Section title={t('targeting.size')} hint={t('targeting.sizeHint')}>
                <ChipGroup
                  options={[
                    ...(Object.keys(AUDIENCE_SIZE_PRESETS) as AudienceSizePreset[]).map((k) => ({ value: k, label: te(`audienceSize.${k}`) })),
                    { value: 'custom' as const, label: te('audienceSize.custom') },
                  ]}
                  value={preset}
                  onChange={(p) => {
                    if (p === preset) {
                      setPreset(null);
                      form.setValue('minFollowers', null);
                      form.setValue('maxFollowers', null);
                      return;
                    }
                    setPreset(p);
                    if (p !== 'custom') {
                      form.setValue('minFollowers', AUDIENCE_SIZE_PRESETS[p].min);
                      form.setValue('maxFollowers', AUDIENCE_SIZE_PRESETS[p].max);
                    }
                  }}
                />
                {preset === 'custom' && (
                  <FieldGrid cols={2} gap={4}>
                    <Field label={t('fields.minFollowers')}>
                      {({ id }) => <Input id={id} type="number" inputMode="numeric" min={0} {...form.register('minFollowers', { setValueAs: (x) => (x === '' || x == null ? null : Number(x)) })} />}
                    </Field>
                    <Field label={t('fields.maxFollowers')} error={fe(errors.maxFollowers)}>
                      {({ id, invalid }) => (
                        <Input id={id} type="number" inputMode="numeric" min={0} invalid={invalid} {...form.register('maxFollowers', { setValueAs: (x) => (x === '' || x == null ? null : Number(x)) })} />
                      )}
                    </Field>
                  </FieldGrid>
                )}
                <Field label={t('fields.minEngagement')} hint={t('fields.minEngagementHint')}>
                  {() => (
                    <Slider
                      label={t('fields.minEngagement')}
                      min={0}
                      max={10}
                      step={0.5}
                      value={v.minEngagementRate ?? 0}
                      onChange={(x) => form.setValue('minEngagementRate', x === 0 ? null : x)}
                      format={(x) => (x === 0 ? tc('any') : `${x}%`)}
                    />
                  )}
                </Field>
              </Section>

              <Section title={t('targeting.blogger')}>
                <Controller
                  control={form.control}
                  name="influencerGender"
                  render={({ field }) => (
                    <Field label={t('fields.bloggerGender')}>{() => <ChipGroup options={genderOptions('genderFilter')} value={field.value ?? 'ANY'} onChange={field.onChange} />}</Field>
                  )}
                />
                <Field label={t('fields.bloggerAge')} error={fe(errors.influencerAgeMax)}>
                  {() => (
                    <RangeInput
                      min={INFLUENCER_AGE_RANGE.min}
                      max={INFLUENCER_AGE_RANGE.max}
                      value={[v.influencerAgeMin ?? null, v.influencerAgeMax ?? null]}
                      onChange={([a, b]) => {
                        form.setValue('influencerAgeMin', a);
                        form.setValue('influencerAgeMax', b);
                      }}
                      labels={{ min: t('fields.ageFrom'), max: t('fields.ageTo') }}
                    />
                  )}
                </Field>
              </Section>

              <Section title={t('targeting.audience')} hint={t('targeting.audienceHint')}>
                <Controller
                  control={form.control}
                  name="audienceGender"
                  render={({ field }) => (
                    <Field label={t('fields.audienceGender')}>{() => <ChipGroup options={genderOptions('audienceGender')} value={field.value ?? 'ANY'} onChange={field.onChange} />}</Field>
                  )}
                />
                <Field label={t('fields.audienceAge')} error={fe(errors.audienceAgeMax)}>
                  {() => (
                    <RangeInput
                      min={13}
                      max={65}
                      value={[v.audienceAgeMin ?? null, v.audienceAgeMax ?? null]}
                      onChange={([a, b]) => {
                        form.setValue('audienceAgeMin', a);
                        form.setValue('audienceAgeMax', b);
                      }}
                      labels={{ min: t('fields.ageFrom'), max: t('fields.ageTo') }}
                    />
                  )}
                </Field>
                <FieldGrid cols={{ base: 1, md: 2 }} gap={4}>
                  <Field label={t('fields.audienceCountry')}>
                    {({ id }) => (
                      <Select id={id} {...form.register('audienceCountry', { setValueAs: (x) => (x === '' ? null : x) })}>
                        <option value="">{tc('any')}</option>
                        {o.countries.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </FieldGrid>
                <Controller
                  control={form.control}
                  name="languages"
                  render={({ field }) => (
                    <Field label={t('fields.languages')} aside={tc('optional')}>
                      {() => <ChipGroup multiple options={o.languages} value={(field.value ?? []) as string[]} onChange={field.onChange} />}
                    </Field>
                  )}
                />
              </Section>
            </Stack>
          )}

          {step === 2 && (
            <Stack gap={8}>
              <Controller
                control={form.control}
                name="paymentType"
                render={({ field }) => (
                  <Field label={t('fields.paymentType')} required>
                    {() => <ChipGroup options={o.paymentTypes} value={field.value} onChange={(x: PaymentType) => field.onChange(x)} />}
                  </Field>
                )}
              />
              {money && (
                <Section title={t('compensation.money')}>
                  <FieldGrid cols={{ base: 1, sm: 3 }} gap={4}>
                    <Field label={t('fields.budgetMin')} error={fe(errors.budgetMin)}>
                      {({ id, invalid }) => (
                        <Input id={id} type="number" inputMode="numeric" min={0} suffix={curSymbol} invalid={invalid} {...form.register('budgetMin', { setValueAs: (x) => (x === '' || x == null ? null : Number(x)) })} />
                      )}
                    </Field>
                    <Field label={t('fields.budgetMax')} error={fe(errors.budgetMax)}>
                      {({ id, invalid }) => (
                        <Input id={id} type="number" inputMode="numeric" min={0} suffix={curSymbol} invalid={invalid} {...form.register('budgetMax', { setValueAs: (x) => (x === '' || x == null ? null : Number(x)) })} />
                      )}
                    </Field>
                    <Field label={t('fields.currency')}>
                      {({ id }) => (
                        <Select id={id} {...form.register('currency')}>
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c} · {te(`currency.${c}`)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </FieldGrid>
                  <Text size="small" tone="muted">
                    {t('compensation.perBlogger')}
                  </Text>
                </Section>
              )}
              {barter && (
                <Section title={t('compensation.barter')}>
                  <Field label={t('fields.barterDescription')} hint={t('fields.barterHint')} error={fe(errors.barterDescription)} required>
                    {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} maxLength={1000} {...form.register('barterDescription')} />}
                  </Field>
                  <Field label={t('fields.barterValue')} aside={tc('optional')}>
                    {({ id }) => <Input id={id} type="number" inputMode="numeric" min={0} suffix={curSymbol} {...form.register('barterValue', { setValueAs: (x) => (x === '' || x == null ? null : Number(x)) })} />}
                  </Field>
                </Section>
              )}
              <Section title={t('compensation.timing')}>
                <FieldGrid cols={{ base: 1, sm: 3 }} gap={4}>
                  <Field label={t('fields.slots')} hint={t('fields.slotsHint')} error={fe(errors.slots)} required>
                    {({ id, invalid }) => <Input id={id} type="number" inputMode="numeric" min={1} max={500} invalid={invalid} {...form.register('slots', { valueAsNumber: true })} />}
                  </Field>
                  <Field label={t('fields.deadline')} error={fe(errors.applicationDeadline)} required>
                    {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} {...form.register('applicationDeadline')} />}
                  </Field>
                  <Field label={t('fields.publishBy')} error={fe(errors.publishBy)} aside={tc('optional')}>
                    {({ id, invalid }) => <Input id={id} type="date" invalid={invalid} {...form.register('publishBy')} />}
                  </Field>
                </FieldGrid>
              </Section>
            </Stack>
          )}

          {step === 3 && (
            <Stack gap={6}>
              <Heading level={3}>{v.title || '—'}</Heading>
              <Text tone="muted" className="whitespace-pre-line" clamp={3}>
                {v.description}
              </Text>
              <DescriptionList
                items={[
                  { label: t('fields.platforms'), value: v.platforms.map((p) => te(`platform.${p}`)).join(', ') },
                  { label: t('fields.formats'), value: v.contentFormats.map((x) => te(`contentFormat.${x}`)).join(', ') || '—' },
                  { label: t('fields.countries'), value: [v.countries.map(o.country).join(', '), (v.cities ?? []).join(', ')].filter(Boolean).join(' · ') },
                  { label: t('targeting.size'), value: range(v.minFollowers, v.maxFollowers, f.compact) },
                  { label: t('fields.bloggerAge'), value: range(v.influencerAgeMin, v.influencerAgeMax) },
                  { label: t('fields.paymentType'), value: te(`paymentType.${v.paymentType}`) },
                  ...(money ? [{ label: t('compensation.money'), value: range(v.budgetMin, v.budgetMax, (n) => f.money(n * 100, v.currency ?? 'AMD')) }] : []),
                  ...(barter ? [{ label: t('compensation.barter'), value: v.barterDescription || '—' }] : []),
                  { label: t('fields.slots'), value: String(v.slots) },
                  { label: t('fields.deadline'), value: v.applicationDeadline ? f.date(`${v.applicationDeadline}T12:00:00+04:00`) : '—' },
                ]}
              />
            </Stack>
          )}
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" icon="arrow-left" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            {tc('back')}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" loading={submitting === 'draft'} disabled={!!submitting} onClick={() => submit(false)}>
              {t('saveDraft')}
            </Button>
            {step < 3 ? (
              <Button iconRight="arrow-right" onClick={next}>
                {tc('next')}
              </Button>
            ) : (
              <Button loading={submitting === 'publish'} disabled={!!submitting} onClick={() => submit(true)}>
                {t('publish')}
              </Button>
            )}
          </div>
        </div>
      </Stack>

      <aside className="order-first lg:order-none">
        <div className="lg:sticky lg:top-24">
          <ReachCounter targeting={targeting} />
          <Text size="small" tone="muted" className="mt-2 hidden lg:block">
            {t('reachHint')}
          </Text>
        </div>
      </aside>
    </div>
  );
}
