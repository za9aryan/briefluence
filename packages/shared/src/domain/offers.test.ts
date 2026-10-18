import { describe, expect, it } from 'vitest';
import {
  canOfferTransition,
  canPublishAnotherOffer,
  isOfferEditable,
  isOfferLive,
  offerPublishTarget,
  offerReviewKey,
} from './offers';

const offer = {
  title: '1 Story',
  description: 'A story about your cafe with a link',
  priceMinor: 1_000_000,
  currency: 'AMD',
  contentFormats: ['STORY'],
  idealBrands: null,
};

describe('offers', () => {
  it('follows the brief-like review lifecycle', () => {
    expect(canOfferTransition('DRAFT', 'ACTIVE')).toBe(false);
    expect(canOfferTransition('DRAFT', 'IN_REVIEW')).toBe(true);
    expect(canOfferTransition('IN_REVIEW', 'ACTIVE')).toBe(true);
    expect(canOfferTransition('REJECTED', 'IN_REVIEW')).toBe(true);
    expect(canOfferTransition('CLOSED', 'ACTIVE')).toBe(false);
    expect(isOfferEditable('ACTIVE')).toBe(false);
    expect(isOfferEditable('PAUSED')).toBe(true);
  });
  it('re-reviews only key changes', () => {
    const approvedKey = offerReviewKey(offer);
    expect(offerPublishTarget({ ...offer, approvedKey: null })).toBe('IN_REVIEW');
    expect(offerPublishTarget({ ...offer, approvedKey })).toBe('ACTIVE');
    expect(offerPublishTarget({ ...offer, priceMinor: 2_000_000, approvedKey })).toBe('IN_REVIEW');
    expect(offerPublishTarget({ ...offer, idealBrands: 'Real estate brokers', approvedKey })).toBe(
      'IN_REVIEW',
    );
  });
  it('enforces the plan offer limit on live offers', () => {
    expect(isOfferLive('IN_REVIEW')).toBe(true);
    expect(isOfferLive('DRAFT')).toBe(false);
    expect(canPublishAnotherOffer(0, 1)).toBe(true);
    expect(canPublishAnotherOffer(1, 1)).toBe(false);
    expect(canPublishAnotherOffer(7, null)).toBe(true);
  });
});
