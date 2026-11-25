'use client';
import { Avatar, Button, Inline, Stack, Text, useToast } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';

/**
 * Uploads an image to /uploads/{kind} and reports the URL. 5 MB, PNG/JPEG/WebP (checked by the API).
 * With `save`, a new or removed image is saved right away (account pages), so it does not wait for
 * the form's Save button; if saving fails the previous image comes back.
 */
export function ImageUpload({
  kind,
  value,
  onChange,
  save,
  name,
  label,
  wide,
}: {
  kind: 'avatar' | 'logo' | 'deal' | 'portfolio' | 'offer';
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  save?: (url: string | null) => Promise<unknown>;
  name: string;
  label: string;
  wide?: boolean;
}) {
  const t = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const set = async (url: string | null) => {
    const before = value ?? null;
    onChange(url);
    if (!save) return;
    try {
      await save(url);
    } catch (e) {
      onChange(before);
      throw e;
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await api.upload(kind, file);
      await set(url);
    } catch (e) {
      toast(errorMessage(e), 'danger');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Stack gap={2}>
      <Text size="small" weight="bold">
        {label}
      </Text>
      <Inline gap={4} wrap>
        {wide ? (
          <div className="flex aspect-[16/9] w-full max-w-xs items-center justify-center overflow-hidden rounded-card border border-line bg-surface">
            {value ? (
              <img src={value} alt="" className="size-full object-cover" />
            ) : (
              <Text size="small" tone="muted">
                16:9
              </Text>
            )}
          </div>
        ) : (
          <Avatar size="xl" name={name || '?'} src={value} square={kind === 'logo'} />
        )}
        <Inline gap={2} wrap>
          <Button
            variant="secondary"
            size="sm"
            icon="upload"
            loading={busy}
            onClick={() => input.current?.click()}
          >
            {value ? t('change') : t('upload')}
          </Button>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => set(null).catch((e) => toast(errorMessage(e), 'danger'))}
            >
              {t('remove')}
            </Button>
          )}
        </Inline>
      </Inline>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </Stack>
  );
}
