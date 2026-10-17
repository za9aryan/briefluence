'use client';
import { Alert, Field, Input, Textarea, Select, type InputProps } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { FieldError, FieldValues, Path, UseFormRegister, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';

/**
 * Validation messages from Zod are English; show a translated generic message per issue code
 * instead, so every error the user sees is in their language.
 */
export function useFieldError() {
  const t = useTranslations('errors.field');
  return (err: FieldError | undefined): string | undefined => {
    if (!err) return undefined;
    // Shared schemas use translation keys as messages (e.g. "pickOne", "rangeInverted").
    if (err.message && t.has(err.message)) return t(err.message);
    switch (err.type) {
      case 'invalid_type':
      case 'required':
        return t('required');
      case 'too_small':
        return t('tooShort');
      case 'too_big':
        return t('tooLong');
      case 'invalid_format':
        return t('format');
      default:
        return t('invalid');
    }
  };
}

interface TextFieldProps<T extends FieldValues> extends Omit<InputProps, 'name'> {
  name: Path<T>;
  label: ReactNode;
  register: UseFormRegister<T>;
  error?: FieldError;
  hint?: ReactNode;
  aside?: ReactNode;
  valueAsNumber?: boolean;
}

export function TextField<T extends FieldValues>({ name, label, register, error, hint, aside, required, valueAsNumber, ...rest }: TextFieldProps<T>) {
  const fe = useFieldError();
  return (
    <Field label={label} error={fe(error)} hint={hint} required={required} aside={aside}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          invalid={invalid}
          {...register(name, valueAsNumber ? { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) } : undefined)}
          {...rest}
        />
      )}
    </Field>
  );
}

export function TextAreaField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  hint,
  aside,
  rows,
  maxLength,
  placeholder,
  required,
}: {
  name: Path<T>;
  label: ReactNode;
  register: UseFormRegister<T>;
  error?: FieldError;
  hint?: ReactNode;
  aside?: ReactNode;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const fe = useFieldError();
  return (
    <Field label={label} error={fe(error)} hint={hint} aside={aside} required={required}>
      {({ id, describedBy, invalid }) => (
        <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={rows} maxLength={maxLength} placeholder={placeholder} {...register(name)} />
      )}
    </Field>
  );
}

export function SelectField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  options,
  placeholder,
  required,
  hint,
}: {
  name: Path<T>;
  label: ReactNode;
  register: UseFormRegister<T>;
  error?: FieldError;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
}) {
  const fe = useFieldError();
  return (
    <Field label={label} error={fe(error)} required={required} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <Select id={id} aria-describedby={describedBy} invalid={invalid} {...register(name, { setValueAs: (v) => (v === '' ? null : v) })}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Puts server-side Zod field errors onto the form and returns a message for the banner. */
export function useServerErrors<T extends FieldValues>(setError: UseFormSetError<T>) {
  const message = useErrorMessage();
  return (err: unknown): string => {
    if (err instanceof ApiError) {
      for (const [field, msgs] of Object.entries(err.fieldErrors)) {
        setError(field as Path<T>, { type: 'server', message: msgs[0] });
      }
    }
    return message(err);
  };
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert tone="danger">{message}</Alert>;
}
