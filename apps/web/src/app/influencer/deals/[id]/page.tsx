'use client';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  ErrorState,
  Heading,
  Icon,
  Inline,
  Modal,
  ScoreMeter,
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
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { ApplicationStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { ApplyModal } from '@/components/influencer/ApplyModal';
import { BriefsChecklist } from '@/components/influencer/StartTrial';
import { api, ApiError } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import { useMe } from '@/lib/hooks/session';
import type { DealDetailDto } from '@/lib/types';

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('deals');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const f = useFormat();
  const o = useOptions();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [applyOpen, setApplyOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const deal = useQuery({ queryKey: ['deal', id], queryFn: () => api.get<DealDetailDto>(`/deals/${id}`) });
  const withdraw = useMutation({
    mutationFn: (appId: string) => api.post(`/applications/${appId}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deal', id] });
      toast(t('withdrawn'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  if (deal.isLoading) return <Skeleton className="h-[70vh] rounded-card" />;
  if (deal.error instanceof ApiError && deal.error.code === 'TRIAL_NOT_STARTED') return <BriefsChecklist />;
  if (deal.isError || !deal.data) return <ErrorState title={tc('notFoundTitle')} retry={<Link href="/influencer/deals" className={buttonStyles({})}>{t('backToFeed')}</Link>} />;
  const d = deal.data;
  const app = d.myApplication;
  const open = d.status === 'ACTIVE' && new Date(d.applicationDeadline) > new Date();
  const canApply = open && (!app || app.status === 'WITHDRAWN') && (d.eligibleAccounts?.length ?? 0) > 0;
  const hasAccess = me?.subscription?.hasAccess ?? false;
  const range = (min: number | null, max: number | null, fmt: (n: number) => string = String) =>
    min == null && max == null ? tc('any') : min != null && max != null ? `${fmt(min)}–${fmt(max)}` : min != null ? `${fmt(min)}+` : `≤ ${fmt(max!)}`;

  const requirements = [
    { label: t('req.platforms'), value: d.platforms.map((p) => te(`platform.${p}`)).join(', ') },
    { label: t('req.formats'), value: d.contentFormats.map((x) => te(`contentFormat.${x}`)).join(', ') },
    { label: t('req.location'), value: [d.countries.map(o.country).join(', '), d.cities.join(', ')].filter(Boolean).join(' · ') },
    { label: t('req.followers'), value: range(d.minFollowers, d.maxFollowers, f.compact) },
    ...(d.minEngagementRate ? [{ label: t('req.engagement'), value: `≥ ${f.percent(d.minEngagementRate)}` }] : []),
    ...(d.niches.length ? [{ label: t('req.niches'), value: d.niches.map(o.niche).join(', ') }] : []),
    ...(d.languages.length ? [{ label: t('req.languages'), value: d.languages.map(o.language).join(', ') }] : []),
    ...(d.influencerGender !== 'ANY' ? [{ label: t('req.bloggerGender'), value: te(`genderFilter.${d.influencerGender}`) }] : []),
    ...(d.influencerAgeMin != null || d.influencerAgeMax != null ? [{ label: t('req.bloggerAge'), value: range(d.influencerAgeMin, d.influencerAgeMax) }] : []),
    ...(d.audienceGender !== 'ANY' ? [{ label: t('req.audienceGender'), value: te(`audienceGender.${d.audienceGender}`) }] : []),
    ...(d.audienceAgeMin != null || d.audienceAgeMax != null ? [{ label: t('req.audienceAge'), value: range(d.audienceAgeMin, d.audienceAgeMax) }] : []),
    ...(d.audienceCountry ? [{ label: t('req.audienceCountry'), value: o.country(d.audienceCountry) }] : []),
  ];

  const applyButton = canApply ? (
    <Button size="lg" block onClick={() => (hasAccess ? setApplyOpen(true) : setPaywall(true))}>
      {t('applyCta')}
    </Button>
  ) : null;

  return (
    <Stack gap={6}>
      <PageHeader back={{ href: '/influencer/deals', label: t('backToFeed') }} title={d.title} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Stack gap={6} className="min-w-0">
          {d.imageUrl && <img src={d.imageUrl} alt="" className="aspect-[16/9] w-full rounded-card object-cover" />}
          <Card>
            <CardHeader title={t('about')} />
            <Text className="whitespace-pre-line">{d.description}</Text>
          </Card>
          <Card>
            <CardHeader title={t('requirements')} />
            <DescriptionList items={requirements} />
          </Card>
        </Stack>

        <Stack gap={4} className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <Stack gap={4}>
              <Inline justify="between" align="start">
                <Stack gap={1}>
                  <Text size="label" tone="muted">
                    {t('compensation')}
                  </Text>
                  <Compensation {...d} />
                </Stack>
                {d.matchScore != null && <ScoreMeter size="lg" value={d.matchScore} label={t('match')} />}
              </Inline>
              {d.barterValue != null && d.paymentType !== 'MONEY' && (
                <Text size="small" tone="muted">
                  {t('barterValue', { value: f.display(d.barterValue, d.currency).main })}
                </Text>
              )}
              <DescriptionList
                items={[
                  { label: t('deadlineLabel'), value: f.date(d.applicationDeadline) },
                  ...(d.publishBy ? [{ label: t('publishBy'), value: f.date(d.publishBy) }] : []),
                  { label: t('slots'), value: t('slotsValue', { filled: d.filled, slots: d.slots }) },
                  { label: t('applicantsLabel'), value: f.number(d.applicantCount) },
                ]}
              />
              {app && app.status !== 'WITHDRAWN' ? (
                <Stack gap={2}>
                  <Inline justify="between">
                    <Text size="small" weight="bold">
                      {t('yourApplication')}
                    </Text>
                    <ApplicationStatusBadge status={app.status} />
                  </Inline>
                  {['APPLIED', 'VIEWED', 'SHORTLISTED'].includes(app.status) && (
                    <Button variant="ghost" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutate(app.id)}>
                      {t('withdraw')}
                    </Button>
                  )}
                  <Link href="/influencer/applications" className={buttonStyles({ variant: 'secondary', block: true })}>
                    {t('openApplications')}
                  </Link>
                </Stack>
              ) : !open ? (
                <Alert tone="info">{t('closed')}</Alert>
              ) : (d.eligibleAccounts?.length ?? 0) === 0 ? (
                <Alert tone="warning">{t('noEligibleAccount')}</Alert>
              ) : (
                applyButton
              )}
            </Stack>
          </Card>

          <Card>
            <Inline gap={2}>
              <Avatar square name={d.brand.companyName} src={d.brand.logoUrl} />
              <Stack gap={0}>
                <Text weight="bold">{d.brand.companyName}</Text>
                {d.brand.city && (
                  <Text size="small" tone="muted">
                    {d.brand.city}
                  </Text>
                )}
              </Stack>
            </Inline>
            {d.brand.description && (
              <Text size="small" tone="muted" className="mt-4" clamp={3}>
                {d.brand.description}
              </Text>
            )}
            <Inline gap={2} wrap className="mt-4">
              {d.brand.instagramUrl && (
                <a href={d.brand.instagramUrl} target="_blank" rel="noopener noreferrer">
                  <Badge variant="small" icon="instagram">
                    Instagram
                  </Badge>
                </a>
              )}
              {d.brand.website && (
                <a href={d.brand.website} target="_blank" rel="noopener noreferrer">
                  <Badge variant="small" icon="globe">
                    {t('website')}
                  </Badge>
                </a>
              )}
            </Inline>
          </Card>
        </Stack>
      </div>

      {/* Sticky apply bar on phones */}
      {applyButton && <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface-raised p-4 lg:hidden">{applyButton}</div>}

      <ApplyModal
        deal={d}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={() => {
          setApplyOpen(false);
          void qc.invalidateQueries({ queryKey: ['deal', id] });
          toast(t('appliedToast'));
        }}
      />

      <Modal
        open={paywall}
        onClose={() => setPaywall(false)}
        size="sm"
        closeLabel={tc('close')}
        title={t('paywall.title')}
        footer={
          <Link href="/influencer/billing" className={buttonStyles({ block: true })}>
            {t('paywall.cta')}
          </Link>
        }
      >
        <Stack gap={2} align="center" className="text-center">
          <span className="inline-flex size-14 items-center justify-center rounded-pill bg-primary-soft">
            <Icon name="card" size="lg" tone="accent" />
          </span>
          <Heading level={3}>{t('paywall.headline')}</Heading>
          <Text tone="muted">{t('paywall.body')}</Text>
        </Stack>
      </Modal>
    </Stack>
  );
}
