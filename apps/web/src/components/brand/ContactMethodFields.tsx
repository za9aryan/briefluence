'use client';
import { CONTACT_KIND, CONTACT_METHODS, type ContactMethod } from '@briefluence/shared';
import { Field, FieldGrid, Input, Select, type IconName } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { Controller, type FieldError, type UseFormReturn } from 'react-hook-form';
import { TextField, useFieldError } from '@/components/forms/form';

export const CONTACT_ICON: Record<ContactMethod, IconName> = {
  TELEGRAM: 'telegram',
  MESSENGER: 'message',
  VIBER: 'phone',
  WHATSAPP: 'message',
  INSTAGRAM: 'instagram',
  PHONE: 'phone',
};

/** Form values these fields bind to (brand and blogger profile forms both have them). */
type ContactValues = {
  contactMethod?: ContactMethod | null;
  contactValue?: string | null;
  contactName?: string | null;
  contactPosition?: string | null;
};

/**
 * One contact method with an input that adapts to it (phone vs @username). Brands also get the
 * contact person's name and position (`withPerson`).
 */
export function ContactMethodFields({
  form: anyForm,
  withPerson = true,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- brand and blogger forms both use it
  form: UseFormReturn<any>;
  withPerson?: boolean;
}) {
  const form = anyForm as UseFormReturn<ContactValues>;
  const t = useTranslations('onboarding');
  const tm = useTranslations('enums.contactMethod');
  const tc = useTranslations('common');
  const fe = useFieldError();
  const errors = form.formState.errors as Partial<Record<keyof ContactValues, FieldError>>;
  const method = form.watch('contactMethod') as ContactMethod | null | undefined;
  const kind = method ? CONTACT_KIND[method] : null;

  return (
    <FieldGrid cols={{ base: 1, md: 2 }}>
      {withPerson && (
        <>
          <TextField
            name="contactName"
            icon="user"
            label={t('contactName')}
            register={form.register}
            error={errors.contactName}
          />
          <TextField
            name="contactPosition"
            label={t('contactPosition')}
            aside={tc('optional')}
            placeholder={t('contactPositionPlaceholder')}
            register={form.register}
            error={errors.contactPosition}
          />
        </>
      )}
      <Field label={t('contactMethod')} error={fe(errors.contactMethod)}>
        {({ id, describedBy, invalid }) => (
          <Controller
            control={form.control}
            name="contactMethod"
            render={({ field }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder={t('contactMethodPlaceholder')}
                options={[
                  { value: '', label: t('contactMethodPlaceholder') },
                  ...CONTACT_METHODS.map((m) => ({
                    value: m,
                    label: tm(m),
                    icon: CONTACT_ICON[m],
                  })),
                ]}
                value={field.value ?? ''}
                onBlur={field.onBlur}
                onChange={(v) => {
                  field.onChange(v === '' ? null : v);
                  form.setValue('contactValue', '', { shouldValidate: false });
                }}
              />
            )}
          />
        )}
      </Field>
      {method && kind && (
        <Field
          label={t(`contactValueLabel.${kind}`)}
          hint={t(`contactValueHint.${method}`)}
          error={fe(errors.contactValue)}
          required
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              icon={CONTACT_ICON[method]}
              type={kind === 'phone' ? 'tel' : 'text'}
              inputMode={kind === 'phone' ? 'tel' : 'text'}
              autoComplete={kind === 'phone' ? 'tel' : 'off'}
              placeholder={
                kind === 'phone'
                  ? '+374 91 123456'
                  : kind === 'usernameOrPhone'
                    ? '@username / +374…'
                    : '@username'
              }
              {...form.register('contactValue')}
            />
          )}
        </Field>
      )}
    </FieldGrid>
  );
}
