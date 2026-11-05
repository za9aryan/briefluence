'use client';
import { setUsernameSchema } from '@briefluence/shared';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Inline,
  PrefixInput,
  Stack,
  Text,
  buttonStyles,
  useToast,
} from '@briefluence/ui';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { InfluencerProfileDto } from '@/lib/types';

/** "Your public page": the blogger picks a username and gets briefluence.com/@username to share. */
export function UsernameCard({
  profile,
  onSaved,
}: {
  profile: InfluencerProfileDto;
  onSaved: (p: InfluencerProfileDto) => void;
}) {
  const t = useTranslations('account');
  const tc = useTranslations('common');
  const tf = useTranslations('errors.field');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState(profile.username ?? '');
  const [error, setError] = useState<string | undefined>();
  // The address people will see; the default is replaced with this site's own on the client.
  const [origin, setOrigin] = useState('https://briefluence.com');
  useEffect(() => setOrigin(window.location.origin), []);
  const host = origin.replace(/^https?:\/\//, '');

  const save = useMutation({
    mutationFn: (username: string | null) =>
      api.put<InfluencerProfileDto>('/influencers/me/username', { username }),
    onSuccess: (p) => {
      setValue(p.username ?? '');
      onSaved(p);
      toast(tc('saved'));
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = () => {
    setError(undefined);
    if (!value.trim()) return save.mutate(null);
    const parsed = setUsernameSchema.safeParse({ username: value });
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message ?? 'invalid';
      return setError(tf.has(key) ? tf(key) : tf('invalid'));
    }
    save.mutate(parsed.data.username);
  };

  const saved = profile.username;
  const link = saved ? `${origin}/@${saved}` : '';
  const dirty = (saved ?? '') !== value.trim().replace(/^@+/, '').toLowerCase();

  return (
    <Card>
      <CardHeader title={t('publicLink')} description={t('publicLinkLead')} />
      <Stack gap={4}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label={t('username')} hint={t('usernameHint')} error={error}>
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-2 sm:flex-row">
                <PrefixInput
                  id={id}
                  aria-describedby={describedBy}
                  prefix={`${host}/@`}
                  value={value}
                  maxLength={31}
                  invalid={!!error}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(undefined);
                  }}
                />
                <Button
                  type="submit"
                  loading={save.isPending}
                  disabled={!dirty}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {tc('save')}
                </Button>
              </div>
            )}
          </Field>
        </form>
        {saved && (
          <>
            <Text size="small" weight="bold" className="wrap-anywhere">
              {link}
            </Text>
            <Inline gap={2} wrap>
              <Button
                variant="secondary"
                size="sm"
                icon="copy"
                onClick={() =>
                  void navigator.clipboard.writeText(link).then(() => toast(t('linkCopied')))
                }
              >
                {t('copyLink')}
              </Button>
              <a
                href={`/@${saved}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles({ variant: 'ghost', size: 'sm' })}
              >
                {t('openPage')}
              </a>
            </Inline>
            {profile.status !== 'APPROVED' && <Alert tone="info">{t('pageNotLive')}</Alert>}
          </>
        )}
      </Stack>
    </Card>
  );
}
