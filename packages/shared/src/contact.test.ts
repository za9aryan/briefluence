import { describe, expect, it } from 'vitest';
import { contactDisplay, contactHref, isValidContact, normalizeContact } from './contact';

describe('contact methods', () => {
  it('validates per method', () => {
    expect(isValidContact('PHONE', '+374 91 123456')).toBe(true);
    expect(isValidContact('PHONE', '@karen')).toBe(false);
    expect(isValidContact('WHATSAPP', '091-12-34-56')).toBe(true);
    expect(isValidContact('INSTAGRAM', '@ararat.cosmetics')).toBe(true);
    expect(isValidContact('INSTAGRAM', '+374 91 123456')).toBe(false);
    expect(isValidContact('TELEGRAM', '@karen_pr')).toBe(true);
    expect(isValidContact('TELEGRAM', '+374 91 123456')).toBe(true);
    expect(isValidContact('MESSENGER', 'https://m.me/ararat.cosmetics')).toBe(true);
  });
  it('normalizes and builds links', () => {
    expect(normalizeContact('WHATSAPP', '+374 (91) 12-34-56')).toBe('+37491123456');
    expect(normalizeContact('INSTAGRAM', 'https://instagram.com/ararat/')).toBe('ararat');
    expect(normalizeContact('TELEGRAM', '@karen')).toBe('karen');
    expect(contactHref('WHATSAPP', '+37491123456')).toBe('https://wa.me/37491123456');
    expect(contactHref('TELEGRAM', 'karen')).toBe('https://t.me/karen');
    expect(contactHref('VIBER', '+37491123456')).toBe('viber://chat?number=%2B37491123456');
    expect(contactHref('PHONE', '+37491123456')).toBe('tel:+37491123456');
    expect(contactDisplay('INSTAGRAM', 'ararat')).toBe('@ararat');
    expect(contactDisplay('PHONE', '+37491123456')).toBe('+37491123456');
  });
});
