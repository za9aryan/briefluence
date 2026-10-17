'use client';
import { REJECTION_REASONS, type Currency, type RejectionReason } from '@briefluence/shared';
import { Alert, Avatar, Button, Card, ChipGroup, Inline, Modal, ScoreMeter, Stack, Text, buttonStyles } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { AccountLine, AccountStats } from '@/components/domain/AccountStats';
import { ApplicationStatusBadge, VerifiedBadge } from '@/components/domain/badges';
import { useFormat } from '@/lib/hooks/format';
import { useOptions } from '@/lib/hooks/options';
import type { ApplicantDto } from '@/lib/types';

export type ApplicantAction = { status: 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED'; rejectionReason?: RejectionReason };

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
  const f = useFormat();
  const o = useOptions();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectionReason | null>(null);
  const [expanded, setExpanded] = useState(false);
  const open = ['APPLIED', 'VIEWED', 'SHORTLISTED'].includes(a.status);

  return (
    <Card p={4}>
      <Stack gap={4}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Inline gap={4} align="start" className="min-w-0">
            <Avatar size="lg" name={a.influencer.displayName} src={a.influencer.avatarUrl} />
            <Stack gap={1} className="min-w-0">
              <Inline gap={2} wrap>
                <Link href={`/brand/influencers/${a.influencer.id}`} className="text-h2 font-bold text-ink hover:text-primary-text">
                  {a.influencer.displayName}
                </Link>
                {a.influencer.verified && <VerifiedBadge />}
              </Inline>
              <Text size="small" tone="muted">
                {[a.influencer.city, a.influencer.niches.map(o.niche).join(', ')].filter(Boolean).join(' · ')}
              </Text>
              {a.account && <AccountLine account={a.account} />}
            </Stack>
          </Inline>
          <Inline gap={4} className="shrink-0">
            <ApplicationStatusBadge status={a.status} />
            <ScoreMeter value={a.matchScore} label={t('match')} />
          </Inline>
        </div>

        <div className="rounded-card bg-surface p-4">
          <Text className="whitespace-pre-line">{a.pitch}</Text>
          <Text size="small" tone="muted" className="mt-2">
            {f.relative(a.createdAt)}
            {a.proposedPrice != null && ` · ${t('price', { price: f.display(a.proposedPrice, currency).main })}`}
          </Text>
        </div>

        {a.account && (
          <div>
            <button type="button" className="min-h-11 text-small font-bold text-primary-text hover:underline" onClick={() => setExpanded((x) => !x)} aria-expanded={expanded}>
              {expanded ? t('hideStats') : t('showStats')}
            </button>
            {expanded && <AccountStats account={a.account} />}
          </div>
        )}

        {a.contacts && (
          <Alert tone="success" title={t('contacts')}>
            <Inline gap={4} wrap>
              {a.contacts.phone && <a href={`tel:${a.contacts.phone}`} className="font-bold underline">{a.contacts.phone}</a>}
              {a.contacts.email && <a href={`mailto:${a.contacts.email}`} className="font-bold underline">{a.contacts.email}</a>}
              {a.contacts.telegram && (
                <a href={`https://t.me/${a.contacts.telegram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                  {a.contacts.telegram}
                </a>
              )}
            </Inline>
          </Alert>
        )}

        {a.status === 'REJECTED' && a.rejectionReason && (
          <Text size="small" tone="muted">
            {t('rejectedFor', { reason: tr(a.rejectionReason as RejectionReason) })}
          </Text>
        )}

        {a.postUrl && (
          <a href={a.postUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles({ variant: 'link', className: 'self-start' })}>
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
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => onAction({ status: 'SHORTLISTED' })}>
              {t('shortlist')}
            </Button>
          )}
          {open && (
            <Button size="sm" loading={busy} onClick={() => onAction({ status: 'ACCEPTED' })}>
              {t('accept')}
            </Button>
          )}
          {a.status === 'ACCEPTED' && (
            <Button size="sm" disabled={!a.postUrl} loading={busy} onClick={() => onAction({ status: 'COMPLETED' })}>
              {a.postUrl ? t('complete') : t('waitingPost')}
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
          <ChipGroup options={REJECTION_REASONS.map((r) => ({ value: r, label: tr(r) }))} value={reason} onChange={setReason} />
        </Stack>
      </Modal>
    </Card>
  );
}
