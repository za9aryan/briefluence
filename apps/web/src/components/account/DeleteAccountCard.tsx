'use client';
import { Button, Card, CardHeader, Field, Input, Modal, Stack, useToast } from '@briefluence/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/forms/form';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useMe } from '@/lib/hooks/session';
import { unlinkPushFromAccount } from '@/lib/pwa';

/**
 * Companies and influencers delete their own account (POST /account/delete). Accounts with a
 * password confirm with it; Google / Apple-only accounts type their email instead.
 */
export function DeleteAccountCard() {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const hasPassword = me?.hasPassword ?? true;
  const ready = hasPassword
    ? value.length > 0
    : value.trim().toLowerCase() === me?.email.toLowerCase();
  const del = useMutation({
    mutationFn: async () => {
      await unlinkPushFromAccount();
      return api.post('/account/delete', { password: hasPassword ? value : '' });
    },
    onSuccess: () => {
      setOpen(false);
      qc.clear();
      toast(t('deletedToast'));
      router.replace('/');
      router.refresh();
    },
  });
  const close = () => {
    setOpen(false);
    setValue('');
    del.reset();
  };
  return (
    <Card>
      <CardHeader title={t('deleteTitle')} description={t('deleteText')} />
      <div className="flex justify-end">
        <Button variant="danger" icon="trash" onClick={() => setOpen(true)}>
          {t('deleteButton')}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={close}
        size="sm"
        closeLabel={tc('close')}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmText')}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!ready}
              loading={del.isPending}
              onClick={() => del.mutate()}
            >
              {t('deleteConfirm')}
            </Button>
          </>
        }
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) del.mutate();
          }}
        >
          <Stack gap={4}>
            <FormError message={del.error ? errorMessage(del.error) : null} />
            <Field
              label={
                hasPassword ? t('deletePassword') : t('deleteTypeEmail', { email: me?.email ?? '' })
              }
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  type={hasPassword ? 'password' : 'email'}
                  autoComplete={hasPassword ? 'current-password' : 'off'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}
