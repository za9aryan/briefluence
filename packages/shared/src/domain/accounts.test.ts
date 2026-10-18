import { describe, expect, it } from 'vitest';
import { isAccountUsable, needsAccountReview } from './accounts';

describe('account review', () => {
  it('uses only approved accounts with access', () => {
    expect(isAccountUsable({ reviewStatus: 'APPROVED', tokenRevokedAt: null })).toBe(true);
    expect(isAccountUsable({ reviewStatus: 'PENDING', tokenRevokedAt: null })).toBe(false);
    expect(isAccountUsable({ reviewStatus: 'REJECTED' })).toBe(false);
    expect(isAccountUsable({ reviewStatus: 'APPROVED', tokenRevokedAt: new Date() })).toBe(false);
  });
  it('re-reviews a different handle or a fixed rejected account', () => {
    const a = { platform: 'TIKTOK', username: 'Ani', reviewStatus: 'APPROVED' as const };
    expect(needsAccountReview(a, { platform: 'TIKTOK', username: 'ani' })).toBe(false);
    expect(needsAccountReview(a, { platform: 'TIKTOK', username: 'ani2' })).toBe(true);
    expect(needsAccountReview(a, { platform: 'INSTAGRAM', username: 'Ani' })).toBe(true);
    expect(
      needsAccountReview(
        { ...a, reviewStatus: 'REJECTED' },
        { platform: 'TIKTOK', username: 'Ani' },
      ),
    ).toBe(true);
  });
});
