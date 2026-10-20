import type { AccountReviewStatus } from '../enums';

export interface PortfolioContent {
  imageUrl: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
}

/** Brands (and applications) only ever show items an admin approved. */
export function isPortfolioVisible(item: { reviewStatus: AccountReviewStatus }): boolean {
  return item.reviewStatus === 'APPROVED';
}

/**
 * Review status after the blogger edits an item: any change to what brands would see goes back to
 * review; saving without changes keeps the current status.
 */
export function portfolioStatusAfterEdit(
  before: PortfolioContent & { reviewStatus: AccountReviewStatus },
  after: PortfolioContent,
): AccountReviewStatus {
  const changed =
    before.imageUrl !== after.imageUrl ||
    before.title !== after.title ||
    (before.description ?? null) !== (after.description ?? null) ||
    (before.linkUrl ?? null) !== (after.linkUrl ?? null);
  return changed ? 'PENDING' : before.reviewStatus;
}

export const FAQ_KEYS = ['brandsWorked', 'audience', 'brandsWanted'] as const;
export type FaqKey = (typeof FAQ_KEYS)[number];

/** The answered "About your work" questions, in a fixed order; unanswered ones are left out. */
export function answeredFaq(p: {
  faqBrandsWorked: string | null;
  faqAudience: string | null;
  faqBrandsWanted: string | null;
}): { key: FaqKey; answer: string }[] {
  const all: [FaqKey, string | null][] = [
    ['brandsWorked', p.faqBrandsWorked],
    ['audience', p.faqAudience],
    ['brandsWanted', p.faqBrandsWanted],
  ];
  return all.flatMap(([key, a]) => (a?.trim() ? [{ key, answer: a.trim() }] : []));
}
