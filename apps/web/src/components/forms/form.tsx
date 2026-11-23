'use client';
import { Alert, Field, Input, Textarea, Select, UrlInput, type InputProps } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import type {
  Control,
  FieldError,
  FieldValues,
  Path,
  UseFormRegister,
  UseFormSetError,
} from 'react-hook-form';
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
  /** A web address: "https://" shown in front (see UrlInput). */
  url?: boolean;
}

export function TextField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  hint,
  aside,
  required,
  valueAsNumber,
  url,
  ...rest
}: TextFieldProps<T>) {
  const fe = useFieldError();
  const Control = url ? UrlInput : Input;
  return (
    <Field label={label} error={fe(error)} hint={hint} required={required} aside={aside}>
      {({ id, describedBy, invalid }) => (
        <Control
          id={id}
          aria-describedby={describedBy}
          invalid={invalid}
          {...register(
            name,
            valueAsNumber
              ? { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) }
              : undefined,
          )}
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
        <Textarea
          id={id}
          aria-describedby={describedBy}
          invalid={invalid}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          {...register(name)}
        />
      )}
    </Field>
  );
}

/** A short list to pick one from; an empty choice (the placeholder) is stored as null. */
export function SelectField<T extends FieldValues>({
  name,
  label,
  control,
  error,
  options,
  placeholder,
  required,
  hint,
}: {
  name: Path<T>;
  label: ReactNode;
  control: Control<T>;
  error?: FieldError;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  hint?: ReactNode;
}) {
  const fe = useFieldError();
  const all = placeholder !== undefined ? [{ value: '', label: placeholder }, ...options] : options;
  return (
    <Field label={label} error={fe(error)} required={required} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              options={all}
              value={(field.value as string | null) ?? ''}
              placeholder={placeholder}
              onChange={(v) => field.onChange(v === '' ? null : v)}
              onBlur={field.onBlur}
            />
          )}
        />
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
