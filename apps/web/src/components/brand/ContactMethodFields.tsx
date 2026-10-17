'use client';
import { CONTACT_KIND, CONTACT_METHODS, type BrandProfileInput, type ContactMethod } from '@briefluence/shared';
import { Field, FieldGrid, Input, Select, type IconName } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { TextField, useFieldError } from '@/components/forms/form';

export const CONTACT_ICON: Record<ContactMethod, IconName> = {
  TELEGRAM: 'telegram',
  MESSENGER: 'message',
  VIBER: 'phone',
  WHATSAPP: 'message',
  INSTAGRAM: 'instagram',
  PHONE: 'phone',
};

/** Contact person: name, optional position, and one contact method whose input adapts to the method. */
export function ContactMethodFields({ form }: { form: UseFormReturn<BrandProfileInput> }) {
  const t = useTranslations('onboarding');
  const tm = useTranslations('enums.contactMethod');
  const tc = useTranslations('common');
  const fe = useFieldError();
  const { errors } = form.formState;
  const method = form.watch('contactMethod') as ContactMethod | null | undefined;
  const kind = method ? CONTACT_KIND[method] : null;

  return (
    <FieldGrid cols={{ base: 1, md: 2 }}>
      <TextField name="contactName" icon="user" label={t('contactName')} register={form.register} error={errors.contactName} />
      <TextField name="contactPosition" label={t('contactPosition')} aside={tc('optional')} placeholder={t('contactPositionPlaceholder')} register={form.register} error={errors.contactPosition} />
      <Field label={t('contactMethod')} error={fe(errors.contactMethod)}>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            {...form.register('contactMethod', {
              setValueAs: (v) => (v === '' ? null : v),
              onChange: () => form.setValue('contactValue', '', { shouldValidate: false }),
            })}
          >
            <option value="">{t('contactMethodPlaceholder')}</option>
            {CONTACT_METHODS.map((m) => (
              <option key={m} value={m}>
                {tm(m)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {method && kind && (
        <Field label={t(`contactValueLabel.${kind}`)} hint={t(`contactValueHint.${method}`)} error={fe(errors.contactValue)} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              icon={CONTACT_ICON[method]}
              type={kind === 'phone' ? 'tel' : 'text'}
              inputMode={kind === 'phone' ? 'tel' : 'text'}
              autoComplete={kind === 'phone' ? 'tel' : 'off'}
              placeholder={kind === 'phone' ? '+374 91 123456' : kind === 'usernameOrPhone' ? '@username / +374…' : '@username'}
              {...form.register('contactValue')}
            />
          )}
        </Field>
      )}
    </FieldGrid>
  );
}
