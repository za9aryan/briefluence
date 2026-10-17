import type { DealStatus } from '../enums';

const DEAL_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['PAUSED', 'CLOSED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'CLOSED', 'EXPIRED'],
  CLOSED: [],
  EXPIRED: [],
};

export function canDealTransition(from: DealStatus, to: DealStatus): boolean {
  return DEAL_TRANSITIONS[from].includes(to);
}

/** Only drafts and paused deals can be edited; editing an active deal would change applicants' terms. */
export function isDealEditable(status: DealStatus): boolean {
  return status === 'DRAFT' || status === 'PAUSED';
}

export function shouldExpire(
  deal: { status: DealStatus; applicationDeadline: Date },
  now: Date,
): boolean {
  return (
    (deal.status === 'ACTIVE' || deal.status === 'PAUSED') &&
    deal.applicationDeadline.getTime() <= now.getTime()
  );
}

/** Accepting this application would exceed the deal's slots. */
export function exceedsSlots(slots: number, filled: number): boolean {
  return filled + 1 > slots;
}

export function isFilled(slots: number, filled: number): boolean {
  return filled >= slots;
}
