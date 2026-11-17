import { describe, expect, it } from 'vitest';
import { cleanPageLocation, isMeasurementId, tracksPath } from './analytics';

describe('analytics', () => {
  it('keeps only "where from" parameters in page URLs', () => {
    expect(cleanPageLocation('https://briefluence.com/reset-password?token=secret')).toBe(
      'https://briefluence.com/reset-password',
    );
    expect(
      cleanPageLocation(
        'https://briefluence.com/for-influencers?utm_source=instagram&code=abc&utm_campaign=launch#x',
      ),
    ).toBe('https://briefluence.com/for-influencers?utm_source=instagram&utm_campaign=launch');
  });

  it('skips the admin area and one-off pages', () => {
    expect(tracksPath('/admin')).toBe(false);
    expect(tracksPath('/admin/statistics')).toBe(false);
    expect(tracksPath('/oauth/mock')).toBe(false);
    expect(tracksPath('/administrator')).toBe(true);
    expect(tracksPath('/influencer/billing')).toBe(true);
  });

  it('accepts only GA4 measurement IDs', () => {
    expect(isMeasurementId('G-AB12CD34EF')).toBe(true);
    expect(isMeasurementId('UA-123')).toBe(false);
    expect(isMeasurementId('G-x"><script>')).toBe(false);
    expect(isMeasurementId(undefined)).toBe(false);
  });
});
