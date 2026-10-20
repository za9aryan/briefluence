'use client';
import { isOfferEditable, isPortfolioVisible } from '@briefluence/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Grid,
  Icon,
  Inline,
  MediaCover,
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
import { usePortfolio } from '@/components/influencer/PortfolioSettings';
import { BriefsChecklist, useBloggerUnlocked } from '@/components/influencer/StartTrial';
import { api } from '@/lib/api';
import type { MyOfferDto } from '@/lib/types';

const PUBLISH_LABEL = { DRAFT: 'publish', REJECTED: 'sendAgain', PAUSED: 'resume' } as const;

export default function MyOffersPage() {
  const t = useTranslations('offers');
  // Like the brief feed: offers need a verified profile and a chosen plan.
  const { me, unlocked } = useBloggerUnlocked();
  const list = useQuery({
    queryKey: ['offers', 'mine'],
    queryFn: () => api.get<MyOfferDto[]>('/offers/mine'),
    enabled: unlocked,
  });
  const act = useOfferActions();
  // Cards without their own cover use the profile photo, else the latest approved portfolio image.
  const portfolio = usePortfolio();
  const fallbackCover =
    me?.influencer?.avatarUrl ?? portfolio.data?.find(isPortfolioVisible)?.imageUrl ?? null;

  return (
    <Stack gap={6}>
      <PageHeader
        title={t('mineTitle')}
        description={t('mineLead')}
        actions={
          unlocked && (
            <Link href="/influencer/offers/new" className={buttonStyles({})}>
              <Icon name="plus" />
              {t('newOffer')}
            </Link>
          )
        }
      />
      {act.limit !== false && <OfferLimitNotice limit={act.limit} />}
      {!me ? (
        <Skeleton className="h-48 rounded-card" />
      ) : !unlocked ? (
        <BriefsChecklist for="offers" />
      ) : list.isLoading ? (
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
        <Grid cols={{ base: 1, md: 2, xl: 3 }} gap={4}>
          {list.data.map((o) => {
            const publishLabel = PUBLISH_LABEL[o.status as keyof typeof PUBLISH_LABEL];
            return (
              <Card key={o.id} p={0} className="flex h-full flex-col overflow-hidden">
                <MediaCover
                  src={o.imageUrl ?? fallbackCover}
                  alt={o.title}
                  fallback={<Icon name="sparkles" className="size-16 text-primary/25" />}
                  topLeft={<OfferStatusBadge status={o.status} />}
                  topRight={<CollaborationBadge type={o.collaborationType} />}
                  bottom={
                    <Link
                      href={`/influencer/offers/${o.id}`}
                      className="line-clamp-2 text-h2 font-bold text-on-scrim hover:underline"
                    >
                      {o.title}
                    </Link>
                  }
                />
                <Stack gap={4} className="flex-1 p-4">
                  <Inline gap={2} justify="between" align="center" wrap>
                    <OfferPrice offer={o} size="body" />
                    <OfferMeta offer={o} />
                  </Inline>
                  <OfferReviewNotice offer={o} />
                  <Stack gap={4} className="mt-auto border-t border-line pt-4">
                    <Inline gap={2} justify="between" align="center" wrap>
                      <Inline gap={2}>
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
                    </Inline>
                    <Inline gap={1}>
                      <Link
                        href={`/influencer/offers/${o.id}`}
                        className={buttonStyles({
                          variant: 'secondary',
                          size: 'sm',
                          className: 'flex-1',
                        })}
                      >
                        {t('requestsTitle')}
                      </Link>
                      <OfferActionsMenu offer={o} publishLabel={publishLabel} act={act} />
                    </Inline>
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}

function OfferActionsMenu({
  offer: o,
  publishLabel,
  act,
}: {
  offer: MyOfferDto;
  publishLabel: (typeof PUBLISH_LABEL)[keyof typeof PUBLISH_LABEL] | undefined;
  act: ReturnType<typeof useOfferActions>;
}) {
  const t = useTranslations('offers');
  return (
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
  );
}
