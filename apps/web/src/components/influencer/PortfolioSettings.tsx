'use client';
import {
  APPLICATION_PORTFOLIO_MAX,
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_KEYS,
  PORTFOLIO_MAX_ITEMS,
  type FaqKey,
} from '@briefluence/shared';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Grid,
  Icon,
  Input,
  Menu,
  MenuItem,
  Modal,
  Skeleton,
  Stack,
  Text,
  Textarea,
  useToast,
} from '@briefluence/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ImageUpload } from '@/components/forms/ImageUpload';
import { PortfolioStatusBadge, PortfolioTile } from '@/components/portfolio/PortfolioParts';
import { api } from '@/lib/api';
import { useErrorMessage } from '@/lib/hooks/errors';
import type { InfluencerProfileDto, PortfolioItemDto } from '@/lib/types';

export const PORTFOLIO_KEY = ['influencer', 'portfolio'];
export const usePortfolio = () =>
  useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: () => api.get<PortfolioItemDto[]>('/influencers/me/portfolio'),
  });

type Draft = { imageUrl: string | null; title: string; description: string; linkUrl: string };
const EMPTY: Draft = { imageUrl: null, title: '', description: '', linkUrl: '' };

/** Settings card: the blogger's past work, each item reviewed by an admin before brands see it. */
export function PortfolioCard() {
  const t = useTranslations('portfolio.settings');
  const tf = useTranslations('portfolio.form');
  const tc = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const list = usePortfolio();
  // null: closed; '' : new item; id: editing that item.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [deleting, setDeleting] = useState<PortfolioItemDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = list.data ?? [];
  const full = items.length >= PORTFOLIO_MAX_ITEMS;

  const open = (item?: PortfolioItemDto) => {
    setError(null);
    setDraft(
      item
        ? {
            imageUrl: item.imageUrl,
            title: item.title,
            description: item.description ?? '',
            linkUrl: item.linkUrl ?? '',
          }
        : EMPTY,
    );
    setEditing(item?.id ?? '');
  };
  const close = () => setEditing(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        imageUrl: draft.imageUrl,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        linkUrl: draft.linkUrl.trim() || null,
      };
      return editing
        ? api.put<PortfolioItemDto>(`/influencers/me/portfolio/${editing}`, body)
        : api.post<PortfolioItemDto>('/influencers/me/portfolio', body);
    },
    onSuccess: (item) => {
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      close();
      toast(item.reviewStatus === 'PENDING' ? tf('saved') : tc('saved'));
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/influencers/me/portfolio/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      setDeleting(null);
      toast(t('deleted'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });
  const canSave = !!draft.imageUrl && draft.title.trim().length >= 2;

  return (
    <Card id="portfolio" className="scroll-mt-24">
      <CardHeader
        title={t('title')}
        description={t('lead', { max: APPLICATION_PORTFOLIO_MAX })}
        actions={
          items.length > 0 && (
            <Button icon="plus" size="sm" disabled={full} onClick={() => open()}>
              {t('add')}
            </Button>
          )
        }
      />
      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : !items.length ? (
        <EmptyState
          icon="image"
          title={t('empty')}
          description={t('emptyLead')}
          action={
            <Button icon="plus" onClick={() => open()}>
              {t('add')}
            </Button>
          }
        />
      ) : (
        <Stack gap={4}>
          <Text size="small" tone="muted">
            {full ? t('limit', { max: PORTFOLIO_MAX_ITEMS }) : t('reviewNote')}
          </Text>
          <Grid cols={{ base: 2, md: 3, lg: 4 }} gap={4}>
            {items.map((i) => (
              <PortfolioTile
                key={i.id}
                item={i}
                top={<PortfolioStatusBadge status={i.reviewStatus} />}
                footer={
                  <>
                    {i.reviewStatus === 'REJECTED' && i.reviewNote && (
                      <Text size="small" className="break-words text-primary-text">
                        {t('rejectedReason', { reason: i.reviewNote })}
                      </Text>
                    )}
                    <div className="mt-2 flex justify-end">
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
                        {(closeMenu) => (
                          <>
                            <MenuItem
                              className="min-h-11 px-4"
                              onClick={() => {
                                closeMenu();
                                open(i);
                              }}
                            >
                              <Icon name="edit" /> {t('edit')}
                            </MenuItem>
                            <MenuItem
                              className="min-h-11 px-4 text-primary-text"
                              onClick={() => {
                                closeMenu();
                                setDeleting(i);
                              }}
                            >
                              <Icon name="trash" /> {t('delete')}
                            </MenuItem>
                          </>
                        )}
                      </Menu>
                    </div>
                  </>
                }
              />
            ))}
          </Grid>
        </Stack>
      )}

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing ? tf('titleEdit') : tf('titleNew')}
        closeLabel={tc('close')}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {tc('cancel')}
            </Button>
            <Button disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
              {tc('save')}
            </Button>
          </>
        }
      >
        <Stack gap={4}>
          {error && <Alert tone="danger">{error}</Alert>}
          <Stack gap={1}>
            <ImageUpload
              kind="portfolio"
              wide
              name={draft.title}
              label={tf('image')}
              value={draft.imageUrl}
              onChange={(url) => setDraft((d) => ({ ...d, imageUrl: url }))}
            />
            <Text size="small" tone="muted">
              {tf('imageHint')}
            </Text>
          </Stack>
          <Field label={tf('name')} required aside={`${draft.title.length}/80`}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                maxLength={80}
                value={draft.title}
                placeholder={tf('namePlaceholder')}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            )}
          </Field>
          <Field label={tf('description')} aside={tc('optional')}>
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                rows={3}
                maxLength={500}
                value={draft.description}
                placeholder={tf('descriptionPlaceholder')}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            )}
          </Field>
          <Field label={tf('link')} hint={tf('linkHint')} aside={tc('optional')}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="url"
                inputMode="url"
                maxLength={500}
                placeholder="https://"
                value={draft.linkUrl}
                onChange={(e) => setDraft((d) => ({ ...d, linkUrl: e.target.value }))}
              />
            )}
          </Field>
        </Stack>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('deleteTitle')}
        description={deleting?.title}
        size="sm"
        closeLabel={tc('close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {t('delete')}
            </Button>
          </>
        }
      >
        <Text>{t('deleteBody')}</Text>
      </Modal>
    </Card>
  );
}

const FIELD: Record<FaqKey, 'faqBrandsWorked' | 'faqAudience' | 'faqBrandsWanted'> = {
  brandsWorked: 'faqBrandsWorked',
  audience: 'faqAudience',
  brandsWanted: 'faqBrandsWanted',
};

/** Settings card: three optional questions; brands see only the answered ones. */
export function FaqCard({ profile }: { profile: InfluencerProfileDto | null | undefined }) {
  const t = useTranslations('portfolio.faq');
  const tc = useTranslations('common');
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<FaqKey, string>>(() => ({
    brandsWorked: profile?.faqBrandsWorked ?? '',
    audience: profile?.faqAudience ?? '',
    brandsWanted: profile?.faqBrandsWanted ?? '',
  }));
  const save = useMutation({
    mutationFn: () =>
      api.put('/influencers/me/faq', {
        faqBrandsWorked: answers.brandsWorked.trim() || null,
        faqAudience: answers.audience.trim() || null,
        faqBrandsWanted: answers.brandsWanted.trim() || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['influencer', 'me'] });
      toast(tc('saved'));
    },
    onError: (e) => toast(errorMessage(e), 'danger'),
  });

  return (
    <Card>
      <CardHeader title={t('title')} description={t('lead')} />
      <Stack gap={4}>
        {FAQ_KEYS.map((k) => (
          <Field
            key={k}
            label={t(`questions.${k}`)}
            aside={`${answers[k].length}/${FAQ_ANSWER_MAX_LENGTH}`}
          >
            {({ id, describedBy }) => (
              <Textarea
                id={id}
                name={FIELD[k]}
                aria-describedby={describedBy}
                rows={3}
                maxLength={FAQ_ANSWER_MAX_LENGTH}
                value={answers[k]}
                placeholder={t(`placeholders.${k}`)}
                onChange={(e) => setAnswers((a) => ({ ...a, [k]: e.target.value }))}
              />
            )}
          </Field>
        ))}
        <div className="flex justify-end">
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {tc('save')}
          </Button>
        </div>
      </Stack>
    </Card>
  );
}
