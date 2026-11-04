'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  brandProfileSchema,
  DEFAULT_COUNTRY,
  stripScheme,
  type BrandProfileInput,
} from '@briefluence/shared';
import { Button, Field, FieldGrid, Heading, Stack, Text } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  FormError,
  TextAreaField,
  TextField,
  useFieldError,
  useServerErrors,
} from '@/components/forms/form';
import { ImageUpload } from '@/components/forms/ImageUpload';
import { CitySelect, CountrySelect } from '@/components/forms/LocationFields';
import { ContactMethodFields } from './ContactMethodFields';
import { api } from '@/lib/api';
import type { BrandProfileDto } from '@/lib/types';

export function BrandProfileForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial?: BrandProfileDto | null;
  submitLabel: string;
  onSaved: (b: BrandProfileDto) => void;
}) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<BrandProfileInput>({
    resolver: zodResolver(brandProfileSchema),
    defaultValues: {
      companyName: initial?.companyName ?? '',
      logoUrl: initial?.logoUrl ?? null,
      website: stripScheme(initial?.website),
      instagramUrl: stripScheme(initial?.instagramUrl),
      description: initial?.description ?? '',
      country: initial?.country ?? DEFAULT_COUNTRY,
      city: initial?.city ?? '',
      contactName: initial?.contactName ?? '',
      contactPosition: initial?.contactPosition ?? '',
      contactMethod: initial?.contactMethod ?? null,
      contactValue: initial?.contactValue
        ? initial.contactValue.startsWith('+')
          ? initial.contactValue
          : `@${initial.contactValue}`
        : '',
    },
  });
  const serverError = useServerErrors(form.setError);
  const { errors } = form.formState;
  const fe = useFieldError();
  const country = form.watch('country');

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      onSaved(await api.put<BrandProfileDto>('/brands/me', v));
    } catch (e) {
      setError(serverError(e));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap={8}>
        <FormError message={error} />
        <Stack gap={4}>
          <Controller
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <ImageUpload
                kind="logo"
                label={t('logo')}
                name={form.watch('companyName') ?? ''}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldGrid cols={{ base: 1, md: 2 }} gap={4}>
            <TextField
              name="companyName"
              label={t('companyName')}
              required
              register={form.register}
              error={errors.companyName}
            />
            <TextField
              name="website"
              url
              icon="globe"
              placeholder="yourcafe.am"
              label={t('website')}
              register={form.register}
              error={errors.website}
            />
            <TextField
              name="instagramUrl"
              url
              icon="instagram"
              placeholder="instagram.com/yourcafe"
              label={t('instagramUrl')}
              register={form.register}
              error={errors.instagramUrl}
            />
            <Controller
              control={form.control}
              name="country"
              render={({ field }) => (
                <Field label={t('country')} required error={fe(errors.country)}>
                  {({ id, invalid, describedBy }) => (
                    <CountrySelect
                      id={id}
                      invalid={invalid}
                      describedBy={describedBy}
                      value={field.value ?? null}
                      onChange={(c) => {
                        field.onChange(c ?? '');
                        // A city belongs to one country: picking another country clears it.
                        if (c !== field.value) form.setValue('city', null);
                      }}
                    />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="city"
              render={({ field }) => (
                <Field label={t('city')} error={fe(errors.city)}>
                  {({ id, invalid, describedBy }) => (
                    <CitySelect
                      id={id}
                      invalid={invalid}
                      describedBy={describedBy}
                      country={country}
                      value={field.value ?? null}
                      onChange={(v) => field.onChange(v)}
                    />
                  )}
                </Field>
              )}
            />
          </FieldGrid>
          <TextAreaField
            name="description"
            label={t('description')}
            aside={tc('optional')}
            rows={4}
            maxLength={2000}
            register={form.register}
            error={errors.description}
          />
        </Stack>
        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={2} size="h2">
              {t('brandContactsTitle')}
            </Heading>
            <Text size="small" tone="muted">
              {t('brandContactsHint')}
            </Text>
          </Stack>
          <ContactMethodFields form={form} />
        </Stack>
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            loading={form.formState.isSubmitting}
            className="w-full sm:w-auto"
          >
            {submitLabel}
          </Button>
        </div>
      </Stack>
    </form>
  );
}
