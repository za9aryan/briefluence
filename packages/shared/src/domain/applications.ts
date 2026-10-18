import type { ApplicationStatus } from '../enums';

/** Statuses a brand may set, keyed by the current status. */
const BRAND_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'],
  VIEWED: ['SHORTLISTED', 'ACCEPTED', 'REJECTED'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['COMPLETED'],
  REJECTED: [],
  WITHDRAWN: [],
  COMPLETED: [],
};

export function canBrandTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return BRAND_TRANSITIONS[from].includes(to);
}

/** Influencers can withdraw any time before the brand accepts. */
export function canWithdraw(status: ApplicationStatus): boolean {
  return status === 'APPLIED' || status === 'VIEWED' || status === 'SHORTLISTED';
}

/** Contacts are revealed to both sides once accepted. */
export function contactsRevealed(status: ApplicationStatus): boolean {
  return status === 'ACCEPTED' || status === 'COMPLETED';
}

/** Applications that count against a deal's slots. */
export const FILLED_STATUSES: ApplicationStatus[] = ['ACCEPTED', 'COMPLETED'];
