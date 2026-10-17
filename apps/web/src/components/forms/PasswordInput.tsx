'use client';
import { Field, Icon, Input } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import type { FieldError, FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { useFieldError } from './form';

export function PasswordField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  hint,
  autoComplete,
  aside,
}: {
  name: Path<T>;
  label: ReactNode;
  register: UseFormRegister<T>;
  error?: FieldError;
  hint?: ReactNode;
  autoComplete: 'current-password' | 'new-password';
  aside?: ReactNode;
}) {
  const t = useTranslations('auth');
  const fe = useFieldError();
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={fe(error)} hint={hint} aside={aside}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} aria-describedby={describedBy} invalid={invalid} className="pr-12" {...register(name)} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t('hidePassword') : t('showPassword')}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted hover:text-ink"
          >
            <Icon name={show ? 'eye-off' : 'eye'} />
          </button>
        </div>
      )}
    </Field>
  );
}
