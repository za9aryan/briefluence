import type { SocialAccount } from '@prisma/client';

/** Social account as exposed by the API: never includes tokens. */
export function publicAccount(a: SocialAccount) {
  return {
    id: a.id,
    platform: a.platform,
    /** MANUAL = numbers typed in by the blogger, not read from the platform. */
    source: a.source,
    username: a.username,
    profileUrl: a.profileUrl,
    avatarUrl: a.avatarUrl,
    followers: a.followers,
    mediaCount: a.mediaCount,
    avgViews: a.avgViews,
    engagementRate: a.engagementRate,
    audienceGender: a.audienceGender,
    audienceAge: a.audienceAge,
    audienceCountries: a.audienceCountries,
    lastSyncedAt: a.lastSyncedAt,
    needsReconnect: !!a.tokenRevokedAt,
  };
}
export type PublicAccount = ReturnType<typeof publicAccount>;
