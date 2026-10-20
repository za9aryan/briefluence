'use client';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Field,
  Grid,
  Icon,
  Inline,
  Input,
  Modal,
  Skeleton,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { CollaborationBadge } from '@/components/domain/badges';
import { ContactLink } from '@/components/domain/ContactLink';
import { OfferMeta, OfferPrice, OfferRequestBadge } from '@/components/offers/OfferParts';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useOptions } from '@/lib/hooks/options';
import type { OfferDetailDto } from '@/lib/types';

/** A blogger's offer as a brand sees it: what they offer, their accounts, and the request button. */
export default function BrandOfferPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('offers');
  const tc = useTranslations('common');
  const o = useOptions();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [budget, setBudget] = useState('');
  const offer = useQuery({
    queryKey: ['offers', id],
    queryFn: () => api.get<OfferDetailDto>(`/offers/${id}`),
  });
  const send = useMutation({
    mutationFn: () =>
      api.post(`/offers/${id}/requests`, {
        message: message.trim(),
        proposedBudget: budget ? Math.round(Number(budget) * 100) : null,
      }),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['offers'] });
      toast(t('requestSent'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  if (offer.isError) return <Alert tone="danger">{tc('notFoundTitle')}</Alert>;
  if (!offer.data) return <Skeleton className="h-[60vh] rounded-card" />;
  const d = offer.data;
  const req = d.myRequest;
  const canRequest = d.status === 'ACTIVE' && (!req || req.status === 'WITHDRAWN');

  return (
    <Stack gap={6}>
      <PageHeader back={{ href: '/brand/offers', label: t('back') }} title={d.title} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Stack gap={6}>
          <Card>
            <Stack gap={4}>
              <Inline gap={2} wrap>
                <CollaborationBadge type={d.collaborationType} />
                <OfferMeta offer={d} />
                <Text size="small" tone="muted">
                  {t('views', { count: d.viewCount })}
                </Text>
              </Inline>
              <OfferPrice offer={d} />
              <Text className="whitespace-pre-line">{d.description}</Text>
              {d.idealBrands && (
                <Text size="small">
                  <Icon name="target" tone="accent" className="mr-1 inline" />
                  {t('wantsToWorkWith', { value: d.idealBrands })}
                </Text>
              )}
              {d.niches.length > 0 && (
                <Text size="small" tone="muted">
                  {d.niches.map(o.niche).join(', ')}
                </Text>
              )}
            </Stack>
          </Card>
          {d.blogger.socialAccounts.length > 0 && (
            <Grid cols={{ base: 1, md: d.blogger.socialAccounts.length > 1 ? 2 : 1 }} gap={4}>
              {d.blogger.socialAccounts.map((a) => (
                <Card key={a.id}>
                  <Stack gap={4}>
                    <AccountLine account={a} />
                    <AccountStats account={a} />
                  </Stack>
                </Card>
              ))}
            </Grid>
          )}
        </Stack>
        <Stack gap={4}>
          <Card>
            <Stack gap={4}>
              <Inline gap={2} align="center">
                <Avatar name={d.blogger.displayName} src={d.blogger.avatarUrl} />
                <Stack gap={0}>
                  <Link
                    href={`/brand/influencers/${d.blogger.id}`}
                    className="text-body font-bold text-ink hover:text-primary-text hover:underline"
                  >
                    {d.blogger.displayName}
                    {d.blogger.verified && (
                      <Icon name="verified" tone="success" className="ml-1 inline" />
                    )}
                  </Link>
                  <Text size="small" tone="muted">
                    {[d.blogger.city, o.country(d.blogger.country)].filter(Boolean).join(', ')}
                  </Text>
                </Stack>
              </Inline>
              {req && req.status !== 'WITHDRAWN' && (
                <Inline gap={2} align="center">
                  <Text size="small">{t('yourRequest', { status: '' })}</Text>
                  <OfferRequestBadge status={req.status} />
                </Inline>
              )}
              {req?.contacts && (
                <Alert tone="success" title={t('bloggerContacts')}>
                  <ContactLink method={req.contacts.method} value={req.contacts.value} />
                </Alert>
              )}
              {canRequest && (
                <Button size="lg" block onClick={() => setOpen(true)}>
                  {t('request')}
                </Button>
              )}
            </Stack>
          </Card>
        </Stack>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={tc('close')}
        title={t('requestTitle')}
        description={d.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button
              disabled={message.trim().length < 10}
              loading={send.isPending}
              onClick={() => send.mutate()}
            >
              {t('request')}
            </Button>
          </>
        }
      >
        <Stack gap={4}>
          <Field label={t('message')} hint={t('messageHint')} required>
            {({ id: fid, describedBy }) => (
              <Textarea
                id={fid}
                aria-describedby={describedBy}
                rows={4}
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
          <Field label={`${t('proposedBudget')} (${d.currency})`} aside={tc('optional')}>
            {({ id: fid }) => (
              <Input
                id={fid}
                type="number"
                inputMode="decimal"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            )}
          </Field>
        </Stack>
      </Modal>
    </Stack>
  );
}
