import { SUPPORT_AUTO_CLOSE_DAYS } from '../constants';
import type { SupportStatus } from '../enums';

const DAY = 86_400_000;

/** A ticket accepts new messages until it is closed; after that the user starts a new one. */
export const isTicketActive = (status: SupportStatus) => status !== 'CLOSED';

/** User or guest wrote: the ticket waits for support again. */
export const statusAfterUserMessage = (): SupportStatus => 'OPEN';

/** Support wrote: the ticket waits for the user. */
export const statusAfterAdminMessage = (): SupportStatus => 'ANSWERED';

/** Answered and the user has been silent for SUPPORT_AUTO_CLOSE_DAYS: close it. */
export function shouldAutoClose(
  t: { status: SupportStatus; lastAdminMessageAt: Date | null },
  now: Date,
): boolean {
  return (
    t.status === 'ANSWERED' &&
    !!t.lastAdminMessageAt &&
    now.getTime() - t.lastAdminMessageAt.getTime() >= SUPPORT_AUTO_CLOSE_DAYS * DAY
  );
}

/** Support replied after the user last opened the chat. */
export function unreadForUser(t: { lastAdminMessageAt: Date | null; userLastReadAt: Date | null }) {
  return !!t.lastAdminMessageAt && (!t.userLastReadAt || t.lastAdminMessageAt > t.userLastReadAt);
}

/** The user wrote after an admin last opened the ticket. */
export function unreadForAdmin(t: {
  lastUserMessageAt: Date | null;
  adminLastReadAt: Date | null;
}) {
  return !!t.lastUserMessageAt && (!t.adminLastReadAt || t.lastUserMessageAt > t.adminLastReadAt);
}

/** Who hears about a user's message: the assignee, or every admin while nobody owns it. */
export function adminsToNotify(assigneeId: string | null, adminIds: string[]): string[] {
  return assigneeId ? [assigneeId] : adminIds;
}
