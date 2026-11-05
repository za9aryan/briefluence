'use client';
import {
  Badge,
  Button,
  buttonStyles,
  Card,
  Carousel,
  CoverChip,
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

/**
 * "See the work" button to where the work lives (the site's name shows on hover). Influencer-
 * supplied, so no referrer and nofollow.
 */
export function PortfolioLink({ url, className }: { url: string; className?: string }) {
  const t = useTranslations('portfolio.view');
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      title={hostname(url)}
      className={buttonStyles({
        variant: 'secondary',
        size: 'sm',
        className: cn('self-start', className),
      })}
    >
      {t('seeWork')}
      <Icon name="external" size="xs" />
    </a>
  );
}

/**
 * One item in a row: the image and the title only (the description and the link are in the large
 * view, so long links never stretch a narrow card). `top`/`footer` for badges and actions; with
 * `onOpen` the whole card opens the large view.
 */
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
  const content = (
    <>
      <div className="relative aspect-[4/5] bg-surface">
        <img src={item.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
        {top && <div className="absolute left-2 top-2">{top}</div>}
      </div>
      <div className="p-4">
        <Text weight="bold" className="line-clamp-2 break-words">
          {item.title}
        </Text>
      </div>
    </>
  );
  return (
    <Card p={0} interactive={!!onOpen} className="flex h-full flex-col overflow-hidden">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="block w-full flex-1 text-left">
          {content}
        </button>
      ) : (
        <div className="flex-1">{content}</div>
      )}
      {footer && <div className="px-4 pb-4">{footer}</div>}
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
  // The index stays when the view closes, so the sheet keeps its content while it slides away.
  const [index, setIndex] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const open = items[Math.min(index, items.length - 1)];
  const show = (n: number) => {
    setIndex(n);
    setOpen(true);
  };
  const go = (d: 1 | -1) => setIndex((i) => (i + d + items.length) % items.length);
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
              onClick={() => show(n)}
              aria-label={i.title}
              className="block aspect-square w-full overflow-hidden rounded-card border border-line bg-surface transition hover:border-primary/40 motion-safe:active:scale-[0.97]"
            >
              <img src={i.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ) : (
            <PortfolioTile key={i.id} item={i} onOpen={() => show(n)} />
          ),
        )}
      </Carousel>
      <Modal
        open={isOpen && !!open}
        onClose={() => setOpen(false)}
        title={open?.title ?? ''}
        size="lg"
        closeLabel={t('close')}
        footer={
          items.length > 1 ? (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                variant="secondary"
                block
                icon="chevron-left"
                aria-label={t('previous')}
                onClick={() => go(-1)}
              >
                {t('prevShort')}
              </Button>
              <Button
                variant="secondary"
                block
                iconRight="chevron-right"
                aria-label={t('next')}
                onClick={() => go(1)}
              >
                {t('nextShort')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {open && (
          <Stack gap={4} key={open.id} className="bf-fade">
            <div className="relative">
              <img
                src={open.imageUrl}
                alt={open.title}
                className="max-h-[60vh] w-full rounded-card bg-surface object-contain"
              />
              {items.length > 1 && (
                <span className="absolute right-2 top-2">
                  <CoverChip>
                    <span className="tabular-nums" aria-live="polite">
                      {t('position', { n: index + 1, total: items.length })}
                    </span>
                  </CoverChip>
                </span>
              )}
            </div>
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
