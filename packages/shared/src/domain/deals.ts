import type { DealStatus } from '../enums';

/**
 * Briefs are moderated: publishing sends a brief to IN_REVIEW; an admin approves it (ACTIVE) or
 * sends it back (REJECTED, editable). A paused brief whose key content is unchanged since the last
 * approval goes straight back to ACTIVE (see publishTarget).
 */
const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['ACTIVE', 'REJECTED', 'CLOSED', 'EXPIRED'],
  REJECTED: ['IN_REVIEW', 'CLOSED', 'EXPIRED'],
  ACTIVE: ['PAUSED', 'CLOSED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'IN_REVIEW', 'CLOSED', 'EXPIRED'],
  CLOSED: [],
  EXPIRED: [],
};

export function canDealTransition(from: DealStatus, to: DealStatus): boolean {
  return DEAL_TRANSITIONS[from].includes(to);
}

/** Live deals cannot be edited (that would change applicants' terms); pause first. */
export function isDealEditable(status: DealStatus): boolean {
  return (
    status === 'DRAFT' || status === 'PAUSED' || status === 'IN_REVIEW' || status === 'REJECTED'
  );
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
  return (
    (deal.status === 'ACTIVE' ||
      deal.status === 'PAUSED' ||
      deal.status === 'IN_REVIEW' ||
      deal.status === 'REJECTED') &&
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
