'use client';
import { isOfferEditable } from '@briefluence/shared';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Inline,
  Skeleton,
  Stack,
  Text,
  buttonStyles,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/app/AppShell';
import { CollaborationBadge } from '@/components/domain/badges';
import { ContactLink } from '@/components/domain/ContactLink';
import {
  OfferMeta,
  OfferPrice,
  OfferRequestBadge,
  OfferStatusBadge,
} from '@/components/offers/OfferParts';
import {
  OfferLimitNotice,
  OfferReviewNotice,
  useOfferActions,
} from '@/components/offers/useOfferActions';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import type { OfferDetailDto, OfferRequestDto } from '@/lib/types';

/** One offer for its blogger: details, status and the requests brands sent. */
export default function MyOfferPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('offers');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const offer = useQuery({
    queryKey: ['offers', id],
    queryFn: () => api.get<OfferDetailDto>(`/offers/${id}`),
  });
  const requests = useQuery({
    queryKey: ['offers', id, 'requests'],
    queryFn: () => api.get<OfferRequestDto[]>(`/offers/${id}/requests`),
  });
  const act = useOfferActions();
  const decide = useMutation({
    mutationFn: ({ rid, accept }: { rid: string; accept: boolean }) =>
      api.post(`/offer-requests/${rid}/${accept ? 'accept' : 'decline'}`),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: ['offers'] });
      toast(v.accept ? t('acceptedToast') : t('declinedToast'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  if (!offer.data) return <Skeleton className="h-[60vh] rounded-card" />;
  const o = offer.data;
  return (
    <Stack gap={6}>
      <PageHeader
        back={{ href: '/influencer/offers', label: t('mineTitle') }}
        title={o.title}
        actions={
          <Inline gap={2} wrap>
            <OfferStatusBadge status={o.status} />
            {isOfferEditable(o.status) && (
              <Link
                href={`/influencer/offers/${id}/edit`}
                className={buttonStyles({ variant: 'secondary', size: 'sm' })}
              >
                {t('edit')}
              </Link>
            )}
            {(o.status === 'DRAFT' || o.status === 'PAUSED' || o.status === 'REJECTED') && (
              <Button
                size="sm"
                loading={act.isPending}
                onClick={() => act.mutate({ id, action: 'publish' })}
              >
                {o.status === 'PAUSED'
                  ? t('resume')
                  : o.status === 'REJECTED'
                    ? t('sendAgain')
                    : t('publish')}
              </Button>
            )}
            {o.status === 'ACTIVE' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => act.mutate({ id, action: 'pause' })}
              >
                {t('pause')}
              </Button>
            )}
          </Inline>
        }
      />
      {act.limit !== false && <OfferLimitNotice limit={act.limit} />}
      <OfferReviewNotice offer={o} />
      <Card>
        <Stack gap={4}>
          <Inline gap={2} wrap>
            <CollaborationBadge type={o.collaborationType} />
            <OfferMeta offer={o} />
            <Text size="small" tone="muted">
              {t('views', { count: o.viewCount })}
            </Text>
          </Inline>
          <OfferPrice offer={o} />
          <Text className="whitespace-pre-line">{o.description}</Text>
          {o.idealBrands && (
            <Text size="small">{t('wantsToWorkWith', { value: o.idealBrands })}</Text>
          )}
        </Stack>
      </Card>

      <Card>
        <CardHeader title={t('requestsTitle')} />
        {!requests.data?.length ? (
          <EmptyState icon="inbox" title={t('noRequests')} />
        ) : (
          <Stack gap={4}>
            {requests.data.map((r) => (
              <div key={r.id} className="rounded-card border border-line p-4">
                <Stack gap={2}>
                  <Inline justify="between" align="start" gap={2}>
                    <Inline gap={2} align="center">
                      <Avatar name={r.brand.companyName} src={r.brand.logoUrl} size="sm" />
                      <Stack gap={0}>
                        <Text weight="bold">{r.brand.companyName}</Text>
                        <Text size="small" tone="muted">
                          {[r.brand.city, f.date(r.createdAt)].filter(Boolean).join(' · ')}
                        </Text>
                      </Stack>
                    </Inline>
                    <OfferRequestBadge status={r.status} />
                  </Inline>
                  <Text className="whitespace-pre-line">{r.message}</Text>
                  {r.proposedBudget != null && (
                    <Text size="small" weight="bold">
                      {t('budget', { price: f.money(r.proposedBudget, o.currency) })}
                    </Text>
                  )}
                  {(r.brand.website || r.brand.instagramUrl) && (
                    <Inline gap={4} wrap>
                      {r.brand.website && (
                        <a
                          href={r.brand.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-small font-bold text-primary-text hover:underline"
                        >
                          {r.brand.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      {r.brand.instagramUrl && (
                        <a
                          href={r.brand.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-small font-bold text-primary-text hover:underline"
                        >
                          Instagram
                        </a>
                      )}
                    </Inline>
                  )}
                  {r.contacts && (
                    <Alert tone="success" title={t('accepted')}>
                      <Stack gap={1}>
                        {(r.contacts.name || r.contacts.position) && (
                          <span>
                            {[r.contacts.name, r.contacts.position].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        <ContactLink method={r.contacts.method} value={r.contacts.value} />
                      </Stack>
                    </Alert>
                  )}
                  {r.status === 'PENDING' && (
                    <Inline gap={2} justify="end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ rid: r.id, accept: false })}
                      >
                        {t('decline')}
                      </Button>
                      <Button
                        size="sm"
                        loading={
                          decide.isPending &&
                          decide.variables?.rid === r.id &&
                          decide.variables.accept
                        }
                        onClick={() => decide.mutate({ rid: r.id, accept: true })}
                      >
                        {t('accept')}
                      </Button>
                    </Inline>
                  )}
                </Stack>
              </div>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
