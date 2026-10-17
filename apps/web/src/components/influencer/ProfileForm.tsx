'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { DEFAULT_COUNTRY, influencerProfileSchema, type InfluencerProfileInput } from '@briefluence/shared';
import { Button, ChipGroup, Field, FieldGrid, Heading, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FormError, SelectField, TextAreaField, TextField, useFieldError, useServerErrors } from '@/components/forms/form';
import { ImageUpload } from '@/components/forms/ImageUpload';
import { ContactMethodFields } from '@/components/brand/ContactMethodFields';
import { api } from '@/lib/api';
import { useOptions } from '@/lib/hooks/options';
import type { InfluencerProfileDto } from '@/lib/types';

const year = new Date().getUTCFullYear();

export function InfluencerProfileForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial?: InfluencerProfileDto | null;
  submitLabel: string;
  onSaved: (p: InfluencerProfileDto) => void;
}) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const fe = useFieldError();
  const o = useOptions();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<InfluencerProfileInput>({
    resolver: zodResolver(influencerProfileSchema),
    defaultValues: {
      displayName: initial?.displayName ?? '',
      avatarUrl: initial?.avatarUrl ?? null,
      bio: initial?.bio ?? '',
      country: initial?.country ?? DEFAULT_COUNTRY,
      city: initial?.city ?? '',
      gender: initial?.gender ?? null,
      birthYear: initial?.birthYear ?? null,
      languages: (initial?.languages ?? ['hy']) as InfluencerProfileInput['languages'],
      niches: (initial?.niches ?? []) as InfluencerProfileInput['niches'],
      contactMethod: initial?.contactMethod ?? null,
      contactValue: initial?.contactValue ? (initial.contactValue.startsWith('+') ? initial.contactValue : `@${initial.contactValue}`) : '',
    },
  });
  const serverError = useServerErrors(form.setError);
  const { errors } = form.formState;
  const country = form.watch('country');
  const cities = o.citiesOf([country]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      onSaved(await api.put<InfluencerProfileDto>('/influencers/me', values));
    } catch (e) {
      setError(serverError(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap={8}>
        <FormError message={error} />
        <Stack gap={4}>
          <Heading level={2} size="h2">
            {t('aboutYou')}
          </Heading>
          <Controller
            control={form.control}
            name="avatarUrl"
            render={({ field }) => <ImageUpload kind="avatar" label={t('photo')} name={form.watch('displayName') ?? ''} value={field.value} onChange={field.onChange} />}
          />
          <FieldGrid cols={{ base: 1, md: 2 }} gap={4}>
            <TextField name="displayName" label={t('displayName')} hint={t('displayNameHint')} required register={form.register} error={errors.displayName} />
            <SelectField
              name="gender"
              label={t('gender')}
              register={form.register}
              error={errors.gender}
              placeholder={t('preferNotToSay')}
              options={o.genders}
              hint={t('genderHint')}
            />
            <SelectField name="country" label={t('country')} required register={form.register} error={errors.country} options={o.countries} />
            <SelectField name="city" label={t('city')} register={form.register} error={errors.city} placeholder={tc('notSet')} options={cities} />
            <TextField
              name="birthYear"
              type="number"
              inputMode="numeric"
              min={year - 100}
              max={year - 13}
              valueAsNumber
              label={t('birthYear')}
              hint={t('birthYearHint')}
              register={form.register}
              error={errors.birthYear}
            />
          </FieldGrid>
          <TextAreaField name="bio" label={t('bio')} aside={tc('optional')} rows={3} maxLength={1000} register={form.register} error={errors.bio} />
        </Stack>

        <Stack gap={4}>
          <Heading level={2} size="h2">
            {t('contentTitle')}
          </Heading>
          <Controller
            control={form.control}
            name="niches"
            render={({ field }) => (
              <Field label={t('niches')} hint={t('nichesHint')} error={fe(errors.niches as never)} required>
                {({ describedBy, invalid }) => (
                  <ChipGroup multiple options={o.niches} value={(field.value ?? []) as string[]} onChange={field.onChange} aria-describedby={describedBy} invalid={invalid} />
                )}
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="languages"
            render={({ field }) => (
              <Field label={t('languages')} hint={t('languagesHint')}>
                {() => <ChipGroup multiple options={o.languages} value={(field.value ?? []) as string[]} onChange={field.onChange} />}
              </Field>
            )}
          />
        </Stack>

        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={2} size="h2">
              {t('contactsTitle')}
            </Heading>
            <Text size="small" tone="muted">
              {t('contactsHint')}
            </Text>
          </Stack>
          <ContactMethodFields form={form} withPerson={false} />
        </Stack>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={form.formState.isSubmitting} className="w-full sm:w-auto">
            {submitLabel}
          </Button>
        </div>
      </Stack>
    </form>
  );
}
