import { z } from 'zod';
import { FAQ_ANSWER_MAX_LENGTH } from '../constants';
import { optionalText, optionalUrl } from './common';

/** One portfolio item: an image (uploaded through /uploads/portfolio), title, optional text and link. */
export const portfolioItemSchema = z.object({
  imageUrl: z.url({ protocol: /^https?$/ }).max(500),
  title: z.string().trim().min(2).max(80),
  description: optionalText(500),
  /** Where the work lives (Reel, TikTok, YouTube, a site): shown to brands as a link. */
  linkUrl: optionalUrl,
});
export type PortfolioItemInput = z.input<typeof portfolioItemSchema>;
export type PortfolioItemData = z.output<typeof portfolioItemSchema>;

/** Optional "About your work" answers. Empty answers are stored as null and hidden from brands. */
export const influencerFaqSchema = z.object({
  faqBrandsWorked: optionalText(FAQ_ANSWER_MAX_LENGTH),
  faqAudience: optionalText(FAQ_ANSWER_MAX_LENGTH),
  faqBrandsWanted: optionalText(FAQ_ANSWER_MAX_LENGTH),
});
export type InfluencerFaqInput = z.input<typeof influencerFaqSchema>;
export type InfluencerFaqData = z.output<typeof influencerFaqSchema>;
