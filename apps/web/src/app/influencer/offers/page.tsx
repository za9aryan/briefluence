'use client';
import { isOfferEditable } from '@briefluence/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Inline,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Text,
  buttonStyles,
} from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/app/AppShell';
import { CollaborationBadge } from '@/components/domain/badges';
import { OfferMeta, OfferPrice, OfferStatusBadge } from '@/components/offers/OfferParts';
import {
  OfferLimitNotice,
  OfferReviewNotice,
  useOfferActions,
} from '@/components/offers/useOfferActions';
import { api } from '@/lib/api';
import type { MyOfferDto } from '@/lib/types';

const PUBLISH_LABEL = { DRAFT: 'publish', REJECTED: 'sendAgain', PAUSED: 'resume' } as const;

export default function MyOffersPage() {
  const t = useTranslations('offers');
  const list = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: () => api.get<MyOfferDto[]>('/offers/mine'),
  });
  const act = useOfferActions();

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('mineTitle')}
        description={t('mineLead')}
        actions={
          <Link href="/influencer/offers/new" className={buttonStyles({})}>
            <Icon name="plus" />
            {t('newOffer')}
          </Link>
        }
      />
      {act.limit !== false && <OfferLimitNotice limit={act.limit} />}
      {list.isLoading ? (
        <Skeleton className="h-48 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState
          icon="sparkles"
          title={t('emptyMine')}
          action={
            <Link href="/influencer/offers/new" className={buttonStyles({})}>
              {t('newOffer')}
            </Link>
          }
        />
      ) : (
        <Stack gap={4}>
          {list.data.map((o) => {
            const publishLabel = PUBLISH_LABEL[o.status as keyof typeof PUBLISH_LABEL];
            return (
              <Card key={o.id} p={4}>
                <Stack gap={4}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <Stack gap={2} className="min-w-0">
                      <Inline gap={2} wrap>
                        <OfferStatusBadge status={o.status} />
                        <CollaborationBadge type={o.collaborationType} />
                        <OfferMeta offer={o} />
                      </Inline>
                      <Link
                        href={`/influencer/offers/${o.id}`}
                        className="text-h2 font-bold text-ink hover:text-primary-text"
                      >
                        {o.title}
                      </Link>
                      <OfferPrice offer={o} size="body" />
                    </Stack>
                    <Inline gap={4} justify={{ base: 'between', md: 'end' }} className="shrink-0">
                      <Stack gap={0} className="text-right">
                        <Inline gap={2} justify="end">
                          <Text weight="bold">{t('requestsCount', { count: o.requestCount })}</Text>
                          {o.newRequestCount > 0 && (
                            <Badge tone="primary">
                              {t('newCount', { count: o.newRequestCount })}
                            </Badge>
                          )}
                        </Inline>
                        <Text size="small" tone="muted">
                          {t('views', { count: o.viewCount })}
                        </Text>
                      </Stack>
                      <Inline gap={1}>
                        <Link
                          href={`/influencer/offers/${o.id}`}
                          className={buttonStyles({ variant: 'secondary', size: 'sm' })}
                        >
                          {t('requestsTitle')}
                        </Link>
                        <Menu
                          trigger={(p) => (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t('actions')}
                              onClick={p.toggle}
                              aria-expanded={p['aria-expanded']}
                              aria-haspopup={p['aria-haspopup']}
                            >
                              <Icon name="menu" />
                            </Button>
                          )}
                        >
                          {(close) => (
                            <>
                              {isOfferEditable(o.status) && (
                                <Link
                                  href={`/influencer/offers/${o.id}/edit`}
                                  onClick={close}
                                  className="flex min-h-11 items-center gap-2 px-4 text-small text-ink hover:bg-surface"
                                >
                                  <Icon name="edit" /> {t('edit')}
                                </Link>
                              )}
                              {publishLabel && (
                                <MenuItem
                                  className="min-h-11 whitespace-nowrap px-4"
                                  onClick={() => {
                                    close();
                                    act.mutate({ id: o.id, action: 'publish' });
                                  }}
                                >
                                  <Icon name="play" /> {t(publishLabel)}
                                </MenuItem>
                              )}
                              {o.status === 'ACTIVE' && (
                                <MenuItem
                                  className="min-h-11 px-4"
                                  onClick={() => {
                                    close();
                                    act.mutate({ id: o.id, action: 'pause' });
                                  }}
                                >
                                  <Icon name="pause" /> {t('pause')}
                                </MenuItem>
                              )}
                              {o.status !== 'CLOSED' && (
                                <MenuItem
                                  className="min-h-11 px-4 text-primary-text"
                                  onClick={() => {
                                    close();
                                    act.mutate({ id: o.id, action: 'close' });
                                  }}
                                >
                                  <Icon name="x-circle" /> {t('close')}
                                </MenuItem>
                              )}
                            </>
                          )}
                        </Menu>
                      </Inline>
                    </Inline>
                  </div>
                  <OfferReviewNotice offer={o} />
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
