'use client';
import { DEAL_STATUSES, type DealStatus } from '@briefluence/shared';
import {
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
  useConfirm,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/components/app/AppShell';
import { AdminDealContent, type AdminDeal } from '@/components/admin/ContentViews';
import { DealStatusBadge } from '@/components/domain/badges';
import { Compensation } from '@/components/domain/Compensation';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import { useFormat } from '@/lib/hooks/format';

type Row = AdminDeal & { applicantCount: number };

export default function AdminDealsPage() {
  const t = useTranslations('admin.deals');
  const tc = useTranslations('common');
  const td = useTranslations('enums.dealStatus');
  const f = useFormat();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'' | DealStatus>('');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<Row | null>(null);
  const confirm = useConfirm();
  const tf = useTranslations('dealForm.confirmClose');
  const askClose = (id: string) =>
    void confirm({ title: tf('title'), description: tf('text'), confirmLabel: tf('confirm') }).then(
      (ok) => ok && close.mutate(id),
    );
  const closable = (d: Row) =>
    ['DRAFT', 'IN_REVIEW', 'REJECTED', 'ACTIVE', 'PAUSED'].includes(d.status);
  const list = useQuery({
    queryKey: ['admin', 'deals', status, q],
    queryFn: () =>
      api.get<Row[]>('/admin/deals', { status: status || undefined, q: q || undefined }),
  });
  const close = useMutation({
    mutationFn: (id: string) => api.post(`/admin/deals/${id}/close`),
    onSuccess: () => {
      setViewing(null);
      void qc.invalidateQueries({ queryKey: ['admin', 'deals'] });
      toast(t('closed'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  return (
    <Stack gap={6}>
      <PageHeader title={t('title')} />
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
          onChange={(e) => setStatus(e.target.value as '' | DealStatus)}
          className="w-auto"
        >
          <option value="">{tc('all')}</option>
          {DEAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {td(s)}
            </option>
          ))}
        </Select>
      </Inline>
      {list.isLoading ? (
        <Skeleton className="h-64 rounded-card" />
      ) : !list.data?.length ? (
        <EmptyState icon="briefcase" title={t('empty')} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t('deal')}</TH>
              <TH>{t('brand')}</TH>
              <TH>{t('status')}</TH>
              <TH>{t('compensation')}</TH>
              <TH>{t('applicants')}</TH>
              <TH>{t('deadline')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {list.data.map((d) => (
              <TR key={d.id}>
                <TD className="max-w-xs">
                  <button
                    type="button"
                    onClick={() => setViewing(d)}
                    className="text-left font-bold text-ink underline-offset-2 hover:underline"
                  >
                    {d.title}
                  </button>
                </TD>
                <TD>{d.brand.companyName}</TD>
                <TD>
                  <DealStatusBadge status={d.status} />
                </TD>
                <TD>
                  <Compensation compact {...d} />
                </TD>
                <TD className="tabular-nums">{d.applicantCount}</TD>
                <TD>{f.date(d.applicationDeadline)}</TD>
                <TD>
                  <Inline gap={1} justify="end" wrap={false}>
                    <Button size="sm" variant="secondary" onClick={() => setViewing(d)}>
                      {t('view')}
                    </Button>
                    {closable(d) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={close.isPending && close.variables === d.id}
                        onClick={() => askClose(d.id)}
                      >
                        {t('close')}
                      </Button>
                    )}
                  </Inline>
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
        footer={
          viewing && closable(viewing) ? (
            <Button variant="ghost" loading={close.isPending} onClick={() => askClose(viewing.id)}>
              {t('close')}
            </Button>
          ) : undefined
        }
      >
        {viewing && <AdminDealContent deal={viewing} />}
      </Modal>
    </Stack>
  );
}
