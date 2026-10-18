import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES } from './enums';
import { NOTIFICATION_LOCALES, renderNotification } from './notifications';

const params = {
  name: 'Ani',
  deal: 'Dinner for two',
  score: 92,
  reason: 'BUDGET',
  count: 3,
  list: 'Cafe: Dinner for two',
  slots: 2,
  days: 3,
  amount: 999,
  limit: 10,
  currency: 'USD',
  date: '2026-11-15T09:00:00Z',
  until: '2026-11-15T09:00:00Z',
  retry: '2026-11-16T00:00:00Z',
  platform: 'INSTAGRAM',
  username: 'ani',
};

describe('renderNotification', () => {
  for (const locale of NOTIFICATION_LOCALES) {
    it(`renders every type in ${locale} without empty or raw placeholders`, () => {
      for (const type of NOTIFICATION_TYPES) {
        const r = renderNotification(type, params, locale)!;
        expect(r, type).not.toBeNull();
        expect(r.title.trim(), type).not.toBe('');
        expect(r.body.trim(), type).not.toBe('');
        expect(r.cta.trim(), type).not.toBe('');
        expect(`${r.title} ${r.body}`, type).not.toMatch(/undefined|NaN|\{|\}/);
      }
    });
  }
  it('uses plural forms and formats money and dates per language', () => {
    expect(renderNotification('NEW_MATCHING_DEALS', { count: 1, list: '' }, 'en')!.title).toBe(
      '1 new brief matches you',
    );
    expect(renderNotification('NEW_MATCHING_DEALS', { count: 5, list: '' }, 'ru')!.title).toBe(
      'Тебе подходят 5 новых брифов',
    );
    expect(
      renderNotification(
        'PAYMENT_SUCCEEDED',
        { amount: 999, currency: 'USD', until: '2026-11-15T09:00:00Z' },
        'en',
      )!.body,
    ).toContain('$9.99');
    expect(
      renderNotification('APPLICATION_REJECTED', { deal: 'X', reason: 'NICHE' }, 'hy')!.body,
    ).toContain('նիշան');
  });
  it('returns null for unknown types', () => {
    expect(renderNotification('SOMETHING_ELSE', {}, 'en')).toBeNull();
  });
});
