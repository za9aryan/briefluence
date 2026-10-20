'use client';
import { REJECTION_REASONS, type Currency, type RejectionReason } from '@briefluence/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  ChipGroup,
  CoverChip,
  Icon,
  Inline,
  MediaCover,
  Modal,
  ScoreMeter,
  Stack,
  Text,
  buttonStyles,
} from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { ApplicationStatusBadge, VerifiedBadge } from '@/components/domain/badges';
import { ContactLink } from '@/components/domain/ContactLink';
import { PortfolioGallery } from '@/components/portfolio/PortfolioParts';
import { useFormat } from '@/lib/hooks/format';
import { PLATFORM_ICON, useOptions } from '@/lib/hooks/options';
import type { ApplicantDto } from '@/lib/types';

export type ApplicantAction = {
  status: 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';
  rejectionReason?: RejectionReason;
};

export function ApplicantCard({
  a,
  currency,
  busy,
  onAction,
}: {
  a: ApplicantDto;
  currency: Currency;
  busy: boolean;
  onAction: (action: ApplicantAction) => void;
}) {
  const t = useTranslations('applications.brand');
  const tc = useTranslations('common');
  const tr = useTranslations('enums.rejectionReason');
  const tp = useTranslations('portfolio.view');
  const f = useFormat();
  const o = useOptions();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [expanded, setExpanded] = useState(false);
  const open = ['APPLIED', 'VIEWED', 'SHORTLISTED'].includes(a.status);

  const top = a.accounts[0];
  return (
    <Card p={0} className="flex flex-col overflow-hidden sm:flex-row">
      {/* The blogger's photo (else their attached work), status and reach on it. */}
      <MediaCover
        aspect="photo"
        src={a.influencer.avatarUrl ?? a.portfolio[0]?.imageUrl}
        alt={a.influencer.displayName}
        className="sm:aspect-auto sm:min-h-56 sm:w-56 sm:shrink-0 lg:w-64"
        fallback={
          <span className="text-display font-extrabold text-primary-text" aria-hidden>
            {initials(a.influencer.displayName)}
          </span>
        }
        topLeft={<ApplicationStatusBadge status={a.status} />}
        bottomLeft={
          top && (
            <CoverChip>
              <Icon name={PLATFORM_ICON[top.platform]} size="xs" label={top.platform} />
              {f.compact(top.followers)}
            </CoverChip>
          )
        }
      />
      <Stack gap={4} className="min-w-0 flex-1 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <Inline gap={4} align="start" className="min-w-0">
            <Stack gap={1} className="min-w-0">
              <Inline gap={2} wrap>
                <Link
                  href={`/brand/influencers/${a.influencer.id}`}
                  className="text-h2 font-bold text-ink hover:text-primary-text"
                >
                  {a.influencer.displayName}
                </Link>
                {a.influencer.verified && <VerifiedBadge />}
              </Inline>
              <Text size="small" tone="muted">
                {[a.influencer.city, a.influencer.niches.map(o.niche).join(', ')]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {a.accounts.length > 1 && (
                <Text size="small" tone="muted">
                  {t('accountsCount', { count: a.accounts.length })}
                </Text>
              )}
            </Stack>
          </Inline>
          <ScoreMeter value={a.matchScore} label={t('match')} />
        </div>

        <div className="rounded-card bg-surface p-4">
          <Text className="whitespace-pre-line">{a.pitch}</Text>
          <Text size="small" tone="muted" className="mt-2">
            {f.relative(a.createdAt)}
            {a.proposedPrice != null &&
              ` · ${t('price', { price: f.display(a.proposedPrice, currency).main })}`}
          </Text>
        </div>

        {a.portfolio.length > 0 && (
          <Stack gap={2}>
            <Text size="small" weight="bold">
              {tp('attached')}
            </Text>
            <div className="max-w-sm">
              <PortfolioGallery items={a.portfolio} compact />
            </div>
          </Stack>
        )}

        {/* All connected accounts, so the brand can plan further collaboration beyond this brief. */}
        {a.accounts.length > 0 && (
          <Stack gap={2}>
            {a.accounts.map((acc) => (
              <Inline key={acc.id} gap={2} wrap>
                <AccountLine account={acc} />
                {acc.id === a.matchedAccountId && a.accounts.length > 1 && (
                  <Badge tone="primary">{t('bestMatch')}</Badge>
                )}
              </Inline>
            ))}
            <button
              type="button"
              className="min-h-11 self-start text-small font-bold text-primary-text hover:underline"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
            >
              {expanded ? t('hideStats') : t('showStats')}
            </button>
            {expanded && (
              <div className="grid gap-4 md:grid-cols-2">
                {a.accounts.map((acc) => (
                  <div key={acc.id} className="rounded-card border border-line p-4">
                    <AccountLine account={acc} link={false} />
                    <div className="mt-4">
                      <AccountStats account={acc} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Stack>
        )}

        {a.contacts && (
          <Alert tone="success" title={t('contacts')}>
            {a.contacts.method && a.contacts.value ? (
              <ContactLink method={a.contacts.method} value={a.contacts.value} />
            ) : (
              t('noContact')
            )}
          </Alert>
        )}

        {a.status === 'REJECTED' && a.rejectionReason && (
          <Text size="small" tone="muted">
            {t('rejectedFor', { reason: tr(a.rejectionReason as RejectionReason) })}
          </Text>
        )}

        {a.postUrl && (
          <a
            href={a.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ variant: 'link', className: 'self-start' })}
          >
            {t('openPost')}
          </a>
        )}

        <Inline gap={2} wrap justify="end">
          {open && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRejecting(true)}>
              {t('reject')}
            </Button>
          )}
          {open && a.status !== 'SHORTLISTED' && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => onAction({ status: 'SHORTLISTED' })}
            >
              {t('shortlist')}
            </Button>
          )}
          {open && (
            <Button size="sm" loading={busy} onClick={() => onAction({ status: 'ACCEPTED' })}>
              {t('accept')}
            </Button>
          )}
          {a.status === 'ACCEPTED' && (
            <Button size="sm" loading={busy} onClick={() => onAction({ status: 'COMPLETED' })}>
              {t('complete')}
            </Button>
          )}
        </Inline>
      </Stack>

      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        size="sm"
        closeLabel={tc('close')}
        title={t('rejectTitle')}
        description={a.influencer.displayName}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!reason}
              onClick={() => {
                if (reason) onAction({ status: 'REJECTED', rejectionReason: reason });
                setRejecting(false);
              }}
            >
              {t('reject')}
            </Button>
          </>
        }
      >
        <Stack gap={2}>
          <Text size="small" tone="muted">
            {t('rejectHint')}
          </Text>
          <ChipGroup
            options={REJECTION_REASONS.map((r) => ({ value: r, label: tr(r) }))}
            value={reason}
            onChange={setReason}
          />
        </Stack>
      </Modal>
    </Card>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
