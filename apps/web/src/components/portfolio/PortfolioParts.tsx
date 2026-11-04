'use client';
import {
  Badge,
  Button,
  Card,
  Carousel,
  Disclosure,
  Icon,
  Modal,
  Stack,
  Text,
  cn,
  type BadgeTone,
} from '@briefluence/ui';
import type { AccountReviewStatus } from '@briefluence/shared';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import type { FaqAnswerDto, PortfolioItemDto } from '@/lib/types';

const STATUS_TONE: Record<AccountReviewStatus, BadgeTone> = {
  PENDING: 'neutral',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export function PortfolioStatusBadge({ status }: { status: AccountReviewStatus }) {
  const t = useTranslations('portfolio.settings.status');
  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** External link to where the work lives. Blogger-supplied, so no referrer and nofollow. */
export function PortfolioLink({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className={cn(
        'inline-flex min-h-11 max-w-full items-center gap-1 text-small font-bold text-primary-text hover:underline',
        className,
      )}
    >
      <Icon name="external" size="xs" />
      <span className="truncate">{hostname(url)}</span>
    </a>
  );
}

/** One item: image on top, title, a short description and the link. `top`/`footer` for badges and actions. */
export function PortfolioTile({
  item,
  top,
  footer,
  onOpen,
}: {
  item: PortfolioItemDto;
  top?: ReactNode;
  footer?: ReactNode;
  onOpen?: () => void;
}) {
  const image = (
    <img src={item.imageUrl} alt={item.title} loading="lazy" className="size-full object-cover" />
  );
  return (
    <Card p={0} className="flex h-full flex-col overflow-hidden">
      <div className="relative aspect-[4/5] bg-surface">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="block size-full"
            aria-label={item.title}
          >
            {image}
          </button>
        ) : (
          image
        )}
        {top && <div className="absolute left-2 top-2">{top}</div>}
      </div>
      <Stack gap={1} className="flex-1 p-4">
        <Text weight="bold" className="break-words">
          {item.title}
        </Text>
        {item.description && (
          <Text size="small" tone="muted" className="line-clamp-3 break-words">
            {item.description}
          </Text>
        )}
        {item.linkUrl && <PortfolioLink url={item.linkUrl} className="mt-auto" />}
        {footer}
      </Stack>
    </Card>
  );
}

/**
 * Company-facing portfolio: a horizontal carousel (swipe on phones, arrows on wider screens when
 * the cards don't fit). Tapping one opens it large (a sheet on phones) with the full text, and
 * previous / next to move through the rest.
 */
export function PortfolioGallery({
  items,
  compact,
}: {
  items: PortfolioItemDto[];
  /** Small square thumbnails only (narrow side cards); title, text and link open in the large view. */
  compact?: boolean;
}) {
  const t = useTranslations('portfolio.view');
  const [index, setIndex] = useState<number | null>(null);
  const open = index != null ? items[index] : undefined;
  const go = (d: 1 | -1) =>
    setIndex((i) => (i == null ? i : (i + d + items.length) % items.length));
  return (
    <>
      <Carousel
        label={t('portfolio')}
        prevLabel={t('previous')}
        nextLabel={t('next')}
        itemClassName={compact ? 'w-24' : 'w-44 sm:w-52'}
      >
        {items.map((i, n) =>
          compact ? (
            <button
              key={i.id}
              type="button"
              onClick={() => setIndex(n)}
              aria-label={i.title}
              className="block aspect-square w-full overflow-hidden rounded-card border border-line bg-surface transition hover:border-primary/40 motion-safe:active:scale-[0.97]"
            >
              <img src={i.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ) : (
            <PortfolioTile key={i.id} item={i} onOpen={() => setIndex(n)} />
          ),
        )}
      </Carousel>
      <Modal
        open={!!open}
        onClose={() => setIndex(null)}
        title={open?.title ?? ''}
        size="lg"
        closeLabel={t('close')}
        footer={
          items.length > 1 ? (
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="secondary" icon="chevron-left" onClick={() => go(-1)}>
                {t('previous')}
              </Button>
              <Text size="small" tone="muted" className="tabular-nums" aria-live="polite">
                {t('position', { n: (index ?? 0) + 1, total: items.length })}
              </Text>
              <Button variant="secondary" iconRight="chevron-right" onClick={() => go(1)}>
                {t('next')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {open && (
          <Stack gap={4} key={open.id} className="bf-fade">
            <img
              src={open.imageUrl}
              alt={open.title}
              className="max-h-[60vh] w-full rounded-card bg-surface object-contain"
            />
            {open.description && (
              <Text className="whitespace-pre-line break-words">{open.description}</Text>
            )}
            {open.linkUrl && <PortfolioLink url={open.linkUrl} />}
          </Stack>
        )}
      </Modal>
    </>
  );
}

/** Answered "About your work" questions as a brand reads them: the same FAQ rows as the public pages. */
export function FaqAnswers({ faq }: { faq: FaqAnswerDto[] }) {
  const t = useTranslations('portfolio.faq.questions');
  return (
    <div>
      {faq.map((f) => (
        <Disclosure key={f.key} summary={t(f.key)}>
          <span className="whitespace-pre-line break-words">{f.answer}</span>
        </Disclosure>
      ))}
    </div>
  );
}
