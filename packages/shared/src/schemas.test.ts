import { describe, expect, it } from 'vitest';
import { dealInputSchema, feedQuerySchema, signupSchema } from './schemas';

const base = {
  title: 'Coffee shop launch',
  description: 'Visit our new cafe in Yerevan and share a reel about it.',
  platforms: ['INSTAGRAM'],
  contentFormats: ['REEL'],
  countries: ['AM'],
  paymentType: 'MONEY',
  budgetMin: 5_000_000,
  budgetMax: 10_000_000,
  applicationDeadline: '2026-11-01T00:00:00Z',
};

describe('schemas', () => {
  it('accepts a minimal valid deal and applies defaults', () => {
    const d = dealInputSchema.parse(base);
    expect(d.slots).toBe(1);
    expect(d.currency).toBe('AMD');
    expect(d.influencerGender).toBe('ANY');
  });
  it('requires a budget for paid deals and a barter description for barter', () => {
    expect(dealInputSchema.safeParse({ ...base, budgetMin: null, budgetMax: null }).success).toBe(false);
    expect(dealInputSchema.safeParse({ ...base, paymentType: 'BARTER' }).success).toBe(false);
    expect(
      dealInputSchema.safeParse({ ...base, paymentType: 'BARTER', barterDescription: 'Free dinner' }).success,
    ).toBe(true);
  });
  it('rejects inverted ranges', () => {
    expect(dealInputSchema.safeParse({ ...base, minFollowers: 10, maxFollowers: 5 }).success).toBe(false);
  });
  it('parses comma-separated feed filters', () => {
    const q = feedQuerySchema.parse({ platform: 'INSTAGRAM,TIKTOK', page: '2' });
    expect(q.platform).toEqual(['INSTAGRAM', 'TIKTOK']);
    expect(q.page).toBe(2);
  });
  it('validates sign-up', () => {
    expect(
      signupSchema.safeParse({ email: 'A@B.am', password: 'secret123', role: 'BRAND', acceptTerms: true }).data
        ?.email,
    ).toBe('a@b.am');
    expect(signupSchema.safeParse({ email: 'a@b.am', password: 'short', role: 'ADMIN', acceptTerms: true }).success).toBe(
      false,
    );
  });
});
