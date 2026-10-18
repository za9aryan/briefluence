import type { AccountReviewStatus } from '../enums';

/**
 * An account counts for matching, applying and brands only once an admin approved it (content,
 * public profile) and, for connected accounts, while we still have access to its stats.
 */
export function isAccountUsable(a: {
  reviewStatus: AccountReviewStatus;
  tokenRevokedAt?: Date | string | null;
}): boolean {
  return a.reviewStatus === 'APPROVED' && !a.tokenRevokedAt;
}

/** Changing which account it is (platform / handle) or fixing a rejected one needs a new review. */
export function needsAccountReview(
  before: { platform: string; username: string; reviewStatus: AccountReviewStatus },
  after: { platform: string; username: string },
): boolean {
  return (
    before.reviewStatus === 'REJECTED' ||
    before.platform !== after.platform ||
    before.username.toLowerCase() !== after.username.toLowerCase()
  );
}
