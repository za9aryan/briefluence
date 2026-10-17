import {
  AUDIENCE_SIZE_PRESETS,
  DEFAULT_COUNTRY,
  toMajor,
  toMinor,
  type AudienceSizePreset,
  type DealInput,
} from '@briefluence/shared';
import type { DealDto } from '@/lib/types';

/** Wizard form state: money in major units (AMD/USD), dates as YYYY-MM-DD in Yerevan time. */
export type DealFormValues = Omit<DealInput, 'budgetMin' | 'budgetMax' | 'barterValue' | 'applicationDeadline' | 'publishBy'> & {
  budgetMin: number | null;
  budgetMax: number | null;
  barterValue: number | null;
  applicationDeadline: string;
  publishBy: string;
};

// Armenia is UTC+4 all year (no DST): a date means "until the end of that day in Yerevan".
const endOfDayYerevan = (d: string) => `${d}T23:59:59+04:00`;
const toYerevanDate = (iso: string) => new Date(new Date(iso).getTime() + 4 * 3_600_000).toISOString().slice(0, 10);

export function defaultDealValues(): DealFormValues {
  const in14 = toYerevanDate(new Date(Date.now() + 14 * 86_400_000).toISOString());
  return {
    title: '',
    description: '',
    imageUrl: null,
    platforms: ['INSTAGRAM'],
    contentFormats: [],
    niches: [],
    countries: [DEFAULT_COUNTRY],
    cities: [],
    languages: [],
    minFollowers: null,
    maxFollowers: null,
    minEngagementRate: null,
    influencerGender: 'ANY',
    influencerAgeMin: null,
    influencerAgeMax: null,
    audienceGender: 'ANY',
    audienceAgeMin: null,
    audienceAgeMax: null,
    audienceCountry: null,
    paymentType: 'BARTER',
    budgetMin: null,
    budgetMax: null,
    currency: 'AMD',
    barterDescription: '',
    barterValue: null,
    slots: 1,
    applicationDeadline: in14,
    publishBy: '',
  };
}

export function dealToFormValues(d: DealDto): DealFormValues {
  return {
    ...defaultDealValues(),
    ...d,
    niches: d.niches as DealFormValues['niches'],
    languages: d.languages as DealFormValues['languages'],
    budgetMin: d.budgetMin != null ? toMajor(d.budgetMin) : null,
    budgetMax: d.budgetMax != null ? toMajor(d.budgetMax) : null,
    barterValue: d.barterValue != null ? toMajor(d.barterValue) : null,
    barterDescription: d.barterDescription ?? '',
    applicationDeadline: toYerevanDate(d.applicationDeadline),
    publishBy: d.publishBy ? toYerevanDate(d.publishBy) : '',
  };
}

/** Converts the wizard state into the API's DealInput (minor units, ISO dates). */
export function toDealInput(v: DealFormValues): DealInput {
  const isMoney = v.paymentType !== 'BARTER';
  const isBarter = v.paymentType !== 'MONEY';
  return {
    ...v,
    budgetMin: isMoney && v.budgetMin != null ? toMinor(v.budgetMin) : null,
    budgetMax: isMoney && v.budgetMax != null ? toMinor(v.budgetMax) : null,
    barterDescription: isBarter ? v.barterDescription : null,
    barterValue: isBarter && v.barterValue != null ? toMinor(v.barterValue) : null,
    applicationDeadline: v.applicationDeadline ? endOfDayYerevan(v.applicationDeadline) : '',
    publishBy: v.publishBy ? endOfDayYerevan(v.publishBy) : null,
  } as DealInput;
}

export function presetOf(min: number | null | undefined, max: number | null | undefined): AudienceSizePreset | 'custom' | null {
  if (min == null && max == null) return null;
  for (const [k, p] of Object.entries(AUDIENCE_SIZE_PRESETS)) if (p.min === min && p.max === max) return k as AudienceSizePreset;
  return 'custom';
}
