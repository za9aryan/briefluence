import type {
  ApplicationStatus,
  CollaborationType,
  ContactMethod,
  ContentFormat,
  Currency,
  DealStatus,
  Gender,
  GenderFilter,
  PaymentStatus,
  PaymentType,
  Platform,
  SubscriptionStatus,
  VerificationStatus,
  PlanCode,
} from '@briefluence/shared';

/** API response shapes (dates arrive as ISO strings). */
export interface SocialAccountDto {
  id: string;
  platform: Platform;
  /** MANUAL = numbers typed in by the blogger. */
  source: 'OAUTH' | 'MANUAL';
  /** Admin review of the account (content, public profile). Only APPROVED ones count. */
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  username: string;
  profileUrl: string;
  avatarUrl: string | null;
  followers: number;
  mediaCount: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  audienceGender: { male?: number; female?: number; other?: number } | null;
  audienceAge: Record<string, number> | null;
  audienceCountries: Record<string, number> | null;
  lastSyncedAt: string | null;
  needsReconnect: boolean;
}

export interface InfluencerProfileDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: string;
  city: string | null;
  gender: Gender | null;
  birthYear: number | null;
  languages: string[];
  niches: string[];
  contactMethod: ContactMethod | null;
  contactValue: string | null;
  status: VerificationStatus;
  rejectionReason: string | null;
  savedFilters: { name: string; query: Record<string, unknown> }[] | null;
  socialAccounts: SocialAccountDto[];
}

export interface BrandProfileDto {
  id: string;
  companyName: string;
  logoUrl: string | null;
  website: string | null;
  instagramUrl: string | null;
  description: string | null;
  country: string;
  city: string | null;
  contactName: string | null;
  contactPosition: string | null;
  contactMethod: ContactMethod | null;
  contactValue: string | null;
}

/** Brand as a blogger sees it; id / name are null on a confidential brief until acceptance. */
export interface BrandCardDto {
  id: string | null;
  companyName: string | null;
  logoUrl: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  description?: string | null;
  country?: string;
  city?: string | null;
}

export interface DealDto {
  id: string;
  brandId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  platforms: Platform[];
  contentFormats: ContentFormat[];
  niches: string[];
  collaborationType: CollaborationType;
  isConfidential: boolean;
  viewCount: number;
  countries: string[];
  cities: string[];
  languages: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagementRate: number | null;
  influencerGender: GenderFilter;
  influencerAgeMin: number | null;
  influencerAgeMax: number | null;
  audienceGender: GenderFilter;
  audienceAgeMin: number | null;
  audienceAgeMax: number | null;
  audienceCountry: string | null;
  paymentType: PaymentType;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: Currency;
  barterDescription: string | null;
  barterValue: number | null;
  slots: number;
  applicationDeadline: string;
  publishBy: string | null;
  status: DealStatus;
  publishedAt: string | null;
  createdAt: string;
  /** Brand + admin only: why the admin sent the brief back. */
  reviewNote?: string | null;
}

export interface FeedDealDto extends DealDto {
  brand: BrandCardDto;
  matchScore: number;
  applicantCount: number;
  myApplication: { id: string; status: ApplicationStatus } | null;
}

export interface DealDetailDto extends DealDto {
  brand: BrandCardDto;
  applicantCount: number;
  filled: number;
  matchScore?: number;
  eligibleAccounts?: {
    id: string;
    platform: Platform;
    username: string;
    followers: number;
    score: number | null;
  }[];
  myApplication?: ApplicationDto | null;
}

export interface MyDealDto extends DealDto {
  applicantCount: number;
  newApplicantCount: number;
  filled: number;
}

export interface ApplicationDto {
  id: string;
  dealId: string;
  status: ApplicationStatus;
  pitch: string;
  proposedPrice: number | null;
  matchScore: number;
  rejectionReason: string | null;
  postUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyApplicationDto extends ApplicationDto {
  deal: Pick<
    DealDto,
    | 'id'
    | 'title'
    | 'status'
    | 'platforms'
    | 'paymentType'
    | 'budgetMin'
    | 'budgetMax'
    | 'currency'
    | 'barterDescription'
    | 'applicationDeadline'
    | 'publishBy'
    | 'collaborationType'
    | 'isConfidential'
  > & { brand: BrandCardDto };
  brandContact: {
    name: string | null;
    position: string | null;
    method: ContactMethod | null;
    value: string | null;
  } | null;
}

export interface ApplicantDto {
  id: string;
  status: ApplicationStatus;
  pitch: string;
  proposedPrice: number | null;
  matchScore: number;
  rejectionReason: string | null;
  postUrl: string | null;
  createdAt: string;
  influencer: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    city: string | null;
    country: string;
    niches: string[];
    verified: boolean;
  };
  /** Account the match score was computed for. */
  matchedAccountId: string;
  /** All connected accounts, largest first. */
  accounts: SocialAccountDto[];
  contacts: { method: ContactMethod | null; value: string | null } | null;
}

export interface ApplicantsDto {
  deal: {
    id: string;
    title: string;
    status: DealStatus;
    slots: number;
    filled: number;
    currency: Currency;
    viewCount: number;
    reviewNote?: string | null;
    isConfidential: boolean;
  };
  items: ApplicantDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  params: Record<string, string | number | null> | null;
  readAt: string | null;
  createdAt: string;
}

/** A plan as bloggers see it (only active plans are listed). */
export interface PlanDto {
  code: PlanCode;
  priceMinor: number;
  currency: Currency;
  applicationLimit: number | null;
  windowDays: number;
}

export interface SubscriptionDto {
  subscription: {
    status: SubscriptionStatus;
    planCode: PlanCode;
    tier: 'BASIC' | 'PRO';
    inFreeDays: boolean;
    plan: PlanDto | null;
    applications: { used: number; limit: number | null; left: number | null };
    trialEndsAt: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    cardMask: string | null;
    hasCard: boolean;
    trialDaysLeft: number;
    hasAccess: boolean;
    nextChargeAt: string | null;
    canCheckout: boolean;
  } | null;
  plans: PlanDto[];
  provider: 'mock' | 'ameriabank';
}

export interface PaymentDto {
  id: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  kind: 'checkout' | 'renewal';
  planCode: PlanCode | null;
  failureReason: string | null;
  createdAt: string;
  providerOrderId: string;
}
