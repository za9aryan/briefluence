import type { OfferStatus } from '../enums';

/**
 * Offer lifecycle mirrors briefs: publishing sends an offer to admin review (IN_REVIEW); approved
 * offers are ACTIVE; REJECTED ones are editable and can be sent again. A paused offer whose key
 * content is unchanged since approval goes straight back to ACTIVE.
 */
const OFFER_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  DRAFT: ['IN_REVIEW', 'CLOSED'],
  IN_REVIEW: ['ACTIVE', 'REJECTED', 'CLOSED'],
  REJECTED: ['IN_REVIEW', 'CLOSED'],
  ACTIVE: ['PAUSED', 'CLOSED'],
  PAUSED: ['ACTIVE', 'IN_REVIEW', 'CLOSED'],
  CLOSED: [],
};

export function canOfferTransition(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from].includes(to);
}

/** Live offers can't be edited (brands may be talking to the blogger about them); pause first. */
export function isOfferEditable(status: OfferStatus): boolean {
  return (
    status === 'DRAFT' || status === 'PAUSED' || status === 'IN_REVIEW' || status === 'REJECTED'
  );
}

/** Offers that use up the plan's offer limit. */
export function isOfferLive(status: OfferStatus): boolean {
  return status === 'IN_REVIEW' || status === 'ACTIVE' || status === 'PAUSED';
}

/** Content an admin checks; changing any of it after approval needs a new review. */
export interface OfferReviewFields {
  title: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  contentFormats: string[];
  idealBrands: string | null;
  imageUrl?: string | null;
}

export function offerReviewKey(o: OfferReviewFields): string {
  return JSON.stringify([
    o.title.trim(),
    o.description.trim(),
    o.priceMinor ?? null,
    o.currency,
    [...o.contentFormats].sort(),
    o.idealBrands?.trim() || null,
    // Appended only when set, so offers approved before covers existed keep their key.
    ...(o.imageUrl ? [o.imageUrl] : []),
  ]);
}

export function offerPublishTarget(
  o: OfferReviewFields & { approvedKey: string | null },
): 'ACTIVE' | 'IN_REVIEW' {
  return o.approvedKey != null && o.approvedKey === offerReviewKey(o) ? 'ACTIVE' : 'IN_REVIEW';
}

/**
 * Whether one more live offer is allowed. `live` counts the blogger's live offers other than the
 * one being published; limit null = unlimited.
 */
export function canPublishAnotherOffer(live: number, limit: number | null): boolean {
  return limit == null || live < limit;
}

/** Contacts are shared both ways once the blogger accepts a brand's request. */
export function offerContactsRevealed(status: string): boolean {
  return status === 'ACCEPTED';
}
