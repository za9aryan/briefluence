import { describe, expect, it } from 'vitest';
import { canBrandTransition, canComplete, canWithdraw, contactsRevealed } from './applications';
import {
  canDealTransition,
  dealReviewKey,
  exceedsSlots,
  isDealEditable,
  isFilled,
  publishTarget,
  shouldExpire,
} from './deals';

describe('application lifecycle', () => {
  it('allows brand transitions along the lifecycle', () => {
    expect(canBrandTransition('APPLIED', 'VIEWED')).toBe(true);
    expect(canBrandTransition('VIEWED', 'SHORTLISTED')).toBe(true);
    expect(canBrandTransition('SHORTLISTED', 'ACCEPTED')).toBe(true);
    expect(canBrandTransition('ACCEPTED', 'COMPLETED')).toBe(true);
    expect(canBrandTransition('ACCEPTED', 'REJECTED')).toBe(false);
    expect(canBrandTransition('WITHDRAWN', 'ACCEPTED')).toBe(false);
  });
  it('allows withdraw only before acceptance', () => {
    expect(canWithdraw('SHORTLISTED')).toBe(true);
    expect(canWithdraw('ACCEPTED')).toBe(false);
  });
  it('reveals contacts after acceptance; completion needs a post URL', () => {
    expect(contactsRevealed('SHORTLISTED')).toBe(false);
    expect(contactsRevealed('ACCEPTED')).toBe(true);
    expect(canComplete('ACCEPTED', null)).toBe(false);
    expect(canComplete('ACCEPTED', 'https://instagram.com/p/x')).toBe(true);
  });
});

describe('deal lifecycle', () => {
  const now = new Date('2026-10-15T00:00:00Z');
  it('expires active deals after the deadline', () => {
    expect(shouldExpire({ status: 'ACTIVE', applicationDeadline: now }, now)).toBe(true);
    expect(shouldExpire({ status: 'DRAFT', applicationDeadline: now }, now)).toBe(false);
  });
  it('tracks slots', () => {
    expect(exceedsSlots(2, 1)).toBe(false);
    expect(exceedsSlots(2, 2)).toBe(true);
    expect(isFilled(2, 2)).toBe(true);
  });
  it('validates status transitions', () => {
    expect(canDealTransition('DRAFT', 'ACTIVE')).toBe(false);
    expect(canDealTransition('DRAFT', 'IN_REVIEW')).toBe(true);
    expect(canDealTransition('IN_REVIEW', 'ACTIVE')).toBe(true);
    expect(canDealTransition('REJECTED', 'ACTIVE')).toBe(false);
    expect(canDealTransition('REJECTED', 'IN_REVIEW')).toBe(true);
    expect(canDealTransition('PAUSED', 'ACTIVE')).toBe(true);
    expect(canDealTransition('CLOSED', 'ACTIVE')).toBe(false);
    expect(isDealEditable('REJECTED')).toBe(true);
    expect(isDealEditable('ACTIVE')).toBe(false);
  });

  describe('review on publish', () => {
    const deal = {
      title: 'Dinner for two',
      description: 'Film a reel at our place',
      imageUrl: null,
      contentFormats: ['REEL', 'STORY'],
      paymentType: 'MONEY',
      budgetMin: 1000,
      budgetMax: 5000,
      currency: 'AMD',
      barterDescription: null,
      barterValue: null,
    };
    const approvedKey = dealReviewKey(deal);
    it('sends never-approved briefs to review', () => {
      expect(publishTarget({ ...deal, approvedKey: null })).toBe('IN_REVIEW');
    });
    it('goes live again when key content is unchanged', () => {
      expect(publishTarget({ ...deal, contentFormats: ['STORY', 'REEL'], approvedKey })).toBe(
        'ACTIVE',
      );
    });
    it('needs review after key changes', () => {
      expect(publishTarget({ ...deal, title: 'Dinner for three', approvedKey })).toBe('IN_REVIEW');
      expect(publishTarget({ ...deal, budgetMax: 9000, approvedKey })).toBe('IN_REVIEW');
      expect(publishTarget({ ...deal, imageUrl: 'https://x/y.png', approvedKey })).toBe(
        'IN_REVIEW',
      );
    });
  });
});
