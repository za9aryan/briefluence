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
): { deal: D; brand: B | typeof HIDDEN_BRAND } {
  if (!deal.isConfidential || brandRevealed(status)) return { deal, brand };
  return { deal: { ...deal, brandId: null }, brand: HIDDEN_BRAND };
}
