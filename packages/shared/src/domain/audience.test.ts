import { describe, expect, it } from 'vitest';
import { engagementRate, mainCountry, majorityGender, shareInAgeRange } from './audience';

describe('audience helpers', () => {
  it('computes engagement rate from recent posts', () => {
    expect(engagementRate([{ likes: 900, comments: 100 }, { likes: 400, comments: 100 }], 10_000)).toBe(7.5);
    expect(engagementRate([], 100)).toBeNull();
    expect(engagementRate([{ likes: 1, comments: 1 }], 0)).toBeNull();
  });
  it('finds majority gender and main country', () => {
    expect(majorityGender({ male: 38.2, female: 61.8 })).toBe('FEMALE');
    expect(majorityGender({ male: 50, female: 50 })).toBeNull();
    expect(majorityGender(null)).toBeNull();
    expect(mainCountry({ AM: 72.4, RU: 9.1 })).toBe('AM');
    expect(mainCountry({})).toBeNull();
  });
  it('sums age buckets with partial overlap', () => {
    const age = { '18-24': 30, '25-34': 40, '35-44': 20, '65+': 10 };
    expect(shareInAgeRange(age, 18, 34)).toBeCloseTo(70);
    expect(shareInAgeRange(age, 25, 29)).toBeCloseTo(20); // half of 25-34
    expect(shareInAgeRange(age, 60, null)).toBeCloseTo(10);
    expect(shareInAgeRange(null, 18, 24)).toBeNull();
  });
});
