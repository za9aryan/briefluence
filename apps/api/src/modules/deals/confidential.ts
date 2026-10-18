import type { ApplicationStatus } from '@briefluence/shared';

/** What a blogger sees instead of the brand on a confidential brief. */
export const HIDDEN_BRAND = {
  id: null,
  companyName: null,
  logoUrl: null,
  website: null,
  instagramUrl: null,
  description: null,
  country: null,
  city: null,
} as const;

/** The brand is revealed to a blogger once the brand accepts them. */
export function brandRevealed(status: ApplicationStatus | null | undefined): boolean {
  return status === 'ACCEPTED' || status === 'COMPLETED';
}

/**
 * Brand as a blogger may see it: hidden on confidential briefs until acceptance. Also drops the
 * brand id from the deal so it cannot be used to look the brand up.
 */
export function forBlogger<D extends { isConfidential: boolean; brandId?: string | null }, B>(
  deal: D,
  brand: B,
  status: ApplicationStatus | null | undefined,
): { deal: Omit<D, ModerationField>; brand: B | typeof HIDDEN_BRAND } {
  const visible = withoutModeration(deal);
  if (!deal.isConfidential || brandRevealed(status)) return { deal: visible, brand };
  return { deal: { ...visible, brandId: null }, brand: HIDDEN_BRAND };
}

/** Admin review data (the reason a brief was sent back, the approval fingerprint) is for the brand and admins only. */
type ModerationField = 'approvedKey' | 'reviewNote' | 'reviewedAt' | 'submittedAt';
export function withoutModeration<D extends object>(deal: D): Omit<D, ModerationField> {
  const {
    approvedKey: _k,
    reviewNote: _n,
    reviewedAt: _r,
    submittedAt: _s,
    ...rest
  } = deal as D & Record<ModerationField, unknown>;
  return rest;
}
