import type { ContactMethod } from './enums';

/** Which kind of value each contact method expects. */
export const CONTACT_KIND: Record<ContactMethod, 'phone' | 'username' | 'usernameOrPhone'> = {
  PHONE: 'phone',
  WHATSAPP: 'phone',
  VIBER: 'phone',
  TELEGRAM: 'usernameOrPhone',
  INSTAGRAM: 'username',
  MESSENGER: 'username',
};

const PHONE = /^\+?[\d\s\-()]{7,20}$/;
const USERNAME = /^@?[A-Za-z0-9._]{2,64}$/;

/** Digits only, with a leading "+" (E.164-like). */
export function normalizePhone(v: string): string {
  const digits = v.replace(/\D/g, '');
  return `+${digits}`;
}

/** Trims, strips a leading "@" and profile-URL prefixes users often paste. */
export function normalizeUsername(v: string): string {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?(t\.me|instagram\.com|m\.me|facebook\.com|messenger\.com\/t)\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
}

export function isValidContact(method: ContactMethod, value: string): boolean {
  const v = value.trim();
  const kind = CONTACT_KIND[method];
  const digits = v.replace(/\D/g, '');
  const phoneOk = PHONE.test(v) && digits.length >= 7 && digits.length <= 15;
  if (kind === 'phone') return phoneOk;
  const u = normalizeUsername(v);
  if (kind === 'username') return USERNAME.test(u);
  return phoneOk || USERNAME.test(u);
}

/** Stored form: phones as +digits, usernames without "@" or URL prefix. */
export function normalizeContact(method: ContactMethod, value: string): string {
  const v = value.trim();
  const kind = CONTACT_KIND[method];
  if (kind === 'phone') return normalizePhone(v);
  if (kind === 'usernameOrPhone' && PHONE.test(v) && v.replace(/\D/g, '').length >= 7) return normalizePhone(v);
  return normalizeUsername(v);
}

/** A link that opens the chat/profile/dialer, or null if none applies. */
export function contactHref(method: ContactMethod, value: string): string | null {
  const isPhone = value.startsWith('+');
  const digits = value.replace(/\D/g, '');
  switch (method) {
    case 'PHONE':
      return `tel:${value}`;
    case 'WHATSAPP':
      return `https://wa.me/${digits}`;
    case 'VIBER':
      return `viber://chat?number=%2B${digits}`;
    case 'TELEGRAM':
      return isPhone ? `https://t.me/${value}` : `https://t.me/${value}`;
    case 'INSTAGRAM':
      return `https://www.instagram.com/${value}`;
    case 'MESSENGER':
      return `https://m.me/${value}`;
  }
}

/** Human-readable form: "@user" for usernames, the number for phones. */
export function contactDisplay(method: ContactMethod, value: string): string {
  return CONTACT_KIND[method] === 'phone' || value.startsWith('+') ? value : `@${value}`;
}
