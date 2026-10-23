import { describe, expect, it } from 'vitest';
import { supportMessageSchema, supportStartSchema } from '../schemas/support';
import {
  adminsToNotify,
  isTicketActive,
  shouldAutoClose,
  statusAfterAdminMessage,
  statusAfterUserMessage,
  unreadForAdmin,
  unreadForUser,
} from './support';

const at = (iso: string) => new Date(iso);

describe('support tickets', () => {
  it('moves between waiting-for-support and waiting-for-user', () => {
    expect(statusAfterUserMessage()).toBe('OPEN');
    expect(statusAfterAdminMessage()).toBe('ANSWERED');
    expect(isTicketActive('ANSWERED')).toBe(true);
    expect(isTicketActive('CLOSED')).toBe(false);
  });

  it('auto-closes answered tickets after 7 silent days only', () => {
    const now = at('2026-10-20T12:00:00Z');
    expect(
      shouldAutoClose({ status: 'ANSWERED', lastAdminMessageAt: at('2026-10-13T12:00:00Z') }, now),
    ).toBe(true);
    expect(
      shouldAutoClose({ status: 'ANSWERED', lastAdminMessageAt: at('2026-10-14T12:00:00Z') }, now),
    ).toBe(false);
    expect(
      shouldAutoClose({ status: 'OPEN', lastAdminMessageAt: at('2026-10-01T12:00:00Z') }, now),
    ).toBe(false);
  });

  it('tracks unread replies on both sides', () => {
    const t = at('2026-10-20T10:00:00Z');
    const later = at('2026-10-20T11:00:00Z');
    expect(unreadForUser({ lastAdminMessageAt: null, userLastReadAt: null })).toBe(false);
    expect(unreadForUser({ lastAdminMessageAt: later, userLastReadAt: t })).toBe(true);
    expect(unreadForUser({ lastAdminMessageAt: t, userLastReadAt: later })).toBe(false);
    expect(unreadForAdmin({ lastUserMessageAt: later, adminLastReadAt: null })).toBe(true);
    expect(unreadForAdmin({ lastUserMessageAt: t, adminLastReadAt: later })).toBe(false);
  });

  it('notifies the assignee, else every admin', () => {
    expect(adminsToNotify('a1', ['a1', 'a2'])).toEqual(['a1']);
    expect(adminsToNotify(null, ['a1', 'a2'])).toEqual(['a1', 'a2']);
  });

  it('a message needs text or an image', () => {
    expect(supportMessageSchema.safeParse({ body: '  ' }).success).toBe(false);
    expect(supportMessageSchema.safeParse({ imageUrl: 'https://x.am/a.png' }).success).toBe(true);
    const start = supportStartSchema.parse({
      topic: 'ACCOUNT',
      body: 'Hi',
      guestEmail: 'Anna@Mail.AM',
    });
    expect(start.guestEmail).toBe('anna@mail.am');
  });
});
