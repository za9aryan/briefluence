'use client';
import { OFFER_STATUSES, type OfferStatus } from '@briefluence/shared';
import {
  Avatar,
  Button,
  EmptyState,
  Inline,
  Input,
  Modal,
  Select,
  Skeleton,
  Stack,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  Text,
} from '@briefluence/ui';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { AdminOfferContent, type AdminOffer } from '@/components/admin/ContentViews';
import { OfferPrice, OfferStatusBadge } from '@/components/offers/OfferParts';
import { api } from '@/lib/api';
import { useFormat } from '@/lib/hooks/format';

type Row = AdminOffer & { requestCount: number };

/** Every influencer offer in any status; open one to read it in full. */
export default function AdminOffersPage() {
  const t = useTranslations('admin.offers');
  const tc = useTranslations('common');
  const ts = useTranslations('offers.status');
  const f = useFormat();
  const [status, setStatus] = useState<'ALL' | OfferStatus>('ALL');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<Row | null>(null);
  const list = useQuery({
    queryKey: ['admin', 'offers', 'list', status, q],
    queryFn: () => api.get<Row[]>('/admin/offers', { status, q: q || undefined }),
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} description={t('lead')} />
      <Inline gap={2} wrap>
        <Input
          icon="search"
          aria-label={tc('search')}
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:w-72"
        />
        <Select
          aria-label={t('status')}
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ALL' | OfferStatus)}
          className="w-auto"
        >
          <option value="ALL">{tc('all')}</option>
          {OFFER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
      </Inline>
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="sparkles" title={t('empty')} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('offer')}</TH>
              <TH>{t('influencer')}</TH>
              <TH>{t('status')}</TH>
              <TH>{t('price')}</TH>
              <TH>{t('requests')}</TH>
              <TH>{t('created')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {list.data.map((o) => (
              <TR key={o.id}>
                <TD className="max-w-xs">
                  <button
                    type="button"
                    onClick={() => setViewing(o)}
                    className="text-left font-bold text-ink underline-offset-2 hover:underline"
                  >
                    {o.title}
                  </button>
                </TD>
                <TD>
                  <Inline gap={2} align="center" wrap={false}>
                    <Avatar name={o.blogger.displayName} src={o.blogger.avatarUrl} size="sm" />
                    <Stack gap={0} className="min-w-0">
                      <Text size="small" weight="bold">
                        {o.blogger.displayName}
                      </Text>
                      <Text size="small" tone="muted">
                        {o.blogger.email}
                      </Text>
                    </Stack>
                  </Inline>
                </TD>
                <TD>
                  <OfferStatusBadge status={o.status} />
                </TD>
                <TD>
                  <OfferPrice offer={o} size="body" />
                </TD>
                <TD className="tabular-nums">{o.requestCount}</TD>
                <TD>{f.date(o.createdAt)}</TD>
                <TD>
                  <Button size="sm" variant="secondary" onClick={() => setViewing(o)}>
                    {t('view')}
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        size="lg"
        closeLabel={tc('close')}
        title={t('viewTitle')}
      >
        {viewing && <AdminOfferContent offer={viewing} />}
      </Modal>
    </Stack>
  );
}
