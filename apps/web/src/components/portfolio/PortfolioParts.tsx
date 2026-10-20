'use client';
import { Badge, Card, Grid, Icon, Modal, Stack, Text, cn, type BadgeTone } from '@briefluence/ui';
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

/** Brand-facing grid; tapping an image opens it large with the full description. */
export function PortfolioGallery({ items }: { items: PortfolioItemDto[] }) {
  const t = useTranslations('portfolio.view');
  const [open, setOpen] = useState<PortfolioItemDto | null>(null);
  return (
    <>
      <Grid cols={{ base: 2, md: 3, lg: 4 }} gap={4}>
        {items.map((i) => (
          <PortfolioTile key={i.id} item={i} onOpen={() => setOpen(i)} />
        ))}
      </Grid>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        size="lg"
        closeLabel={t('close')}
      >
        {open && (
          <Stack gap={4}>
            <img
              src={open.imageUrl}
              alt={open.title}
              className="max-h-[70vh] w-full rounded-card object-contain"
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

/** Answered "About your work" questions as a brand reads them. */
export function FaqAnswers({ faq }: { faq: FaqAnswerDto[] }) {
  const t = useTranslations('portfolio.view.questions');
  return (
    <dl className="flex flex-col gap-4">
      {faq.map((f) => (
        <div key={f.key}>
          <dt className="text-small font-bold text-ink-muted">{t(f.key)}</dt>
          <dd className="mt-1 whitespace-pre-line break-words text-body text-ink">{f.answer}</dd>
        </div>
      ))}
    </dl>
  );
}
