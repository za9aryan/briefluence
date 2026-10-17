import { describe, expect, it } from 'vitest';
import { convertMinor, formatMoney, type Rates } from './money';

const rates: Rates = { AMD: 1, USD: 400, RUB: 4 };

describe('convertMinor', () => {
  it('converts through AMD-per-unit rates', () => {
    expect(convertMinor(100_000_00, 'AMD', 'USD', rates)).toBe(250_00); // ֏100,000 → $250
    expect(convertMinor(250_00, 'USD', 'AMD', rates)).toBe(100_000_00);
    expect(convertMinor(1_000_00, 'RUB', 'USD', rates)).toBe(10_00); // ₽1,000 → $10
    expect(convertMinor(10_00, 'USD', 'RUB', rates)).toBe(1_000_00);
  });
  it('is the identity for the same currency and rounds to minor units', () => {
    expect(convertMinor(123, 'USD', 'USD', rates)).toBe(123);
    expect(convertMinor(1, 'AMD', 'USD', rates)).toBe(0);
  });
  it('fails loudly on a missing rate', () => {
    expect(() => convertMinor(100, 'USD', 'RUB', { AMD: 1, USD: 400, RUB: 0 })).toThrow();
  });
});

describe('formatMoney', () => {
  it('uses whole units for AMD and RUB, cents for USD', () => {
    expect(formatMoney(999, 'USD', 'en-US')).toBe('$9.99');
    expect(formatMoney(150_000_00, 'AMD', 'en-US')).toMatch(/150,000/);
    expect(formatMoney(5_000_00, 'RUB', 'en-US')).toMatch(/5,000/);
  });
});
