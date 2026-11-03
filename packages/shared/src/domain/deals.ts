import type { DealStatus } from '../enums';

/**
 * Briefs are moderated: publishing sends a brief to IN_REVIEW; an admin approves it (ACTIVE) or
 * sends it back (REJECTED, editable). A paused brief whose key content is unchanged since the last
 * approval goes straight back to ACTIVE (see publishTarget). A closed or expired brief can be
 * reopened: it becomes PAUSED, so the company can set a new deadline and publish it again.
 */
const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['ACTIVE', 'REJECTED', 'CLOSED', 'EXPIRED'],
  REJECTED: ['IN_REVIEW', 'CLOSED', 'EXPIRED'],
  ACTIVE: ['PAUSED', 'CLOSED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'IN_REVIEW', 'CLOSED', 'EXPIRED'],
  CLOSED: ['PAUSED'],
  EXPIRED: ['PAUSED'],
};

export function canDealTransition(from: DealStatus, to: DealStatus): boolean {
  return DEAL_TRANSITIONS[from].includes(to);
}

/** Briefs edited in the full editor with "Save draft" / "Publish" (not live). */
export function isDealEditable(status: DealStatus): boolean {
  return (
    status === 'DRAFT' || status === 'PAUSED' || status === 'IN_REVIEW' || status === 'REJECTED'
  );
}

/**
 * The company can change this brief now. A live (ACTIVE) brief is edited in place: changes an
 * admin does not check stay live; changes to reviewed content send it back to review
 * (the same check as publishTarget).
 */
export function canEditDeal(status: DealStatus): boolean {
  return isDealEditable(status) || status === 'ACTIVE';
}

/** A closed or expired brief can come back (as PAUSED) to get a new deadline. */
export function canReopenDeal(status: DealStatus): boolean {
  return status === 'CLOSED' || status === 'EXPIRED';
}

/** Statuses bloggers never see (unless they already applied). */
export function isDealHiddenFromBloggers(status: DealStatus): boolean {
  return status === 'DRAFT' || status === 'IN_REVIEW' || status === 'REJECTED';
}

/** Fields an admin checks. Changing any of them after approval needs a new review. */
export interface DealReviewFields {
  title: string;
  description: string;
  imageUrl: string | null;
  contentFormats: string[];
  paymentType: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  barterDescription: string | null;
  barterValue: number | null;
}

/** Stable fingerprint of the reviewed content, stored on approval. */
export function dealReviewKey(d: DealReviewFields): string {
  return JSON.stringify([
    d.title.trim(),
    d.description.trim(),
    d.imageUrl ?? null,
    [...d.contentFormats].sort(),
    d.paymentType,
    d.budgetMin ?? null,
    d.budgetMax ?? null,
    d.currency,
    d.barterDescription?.trim() || null,
    d.barterValue ?? null,
  ]);
}

/** Where "Publish" takes a brief: live if this exact content was approved before, else review. */
export function publishTarget(
  d: DealReviewFields & { approvedKey: string | null },
): 'ACTIVE' | 'IN_REVIEW' {
  return d.approvedKey != null && d.approvedKey === dealReviewKey(d) ? 'ACTIVE' : 'IN_REVIEW';
}

export function shouldExpire(
  deal: { status: DealStatus; applicationDeadline: Date },
  now: Date,
): boolean {
  // A paused brief is hidden already; it is not expired, so a reopened one can get a new date.
  return (
    (deal.status === 'ACTIVE' || deal.status === 'IN_REVIEW' || deal.status === 'REJECTED') &&
    deal.applicationDeadline.getTime() <= now.getTime()
  );
}

/** Accepting this application would exceed the deal's slots. */
export function exceedsSlots(slots: number, filled: number): boolean {
  return filled + 1 > slots;
}

export function isFilled(slots: number, filled: number): boolean {
  return filled >= slots;
}
