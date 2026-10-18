-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "reuseReviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SocialAccountLink" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "externalId" TEXT,
    "socialAccountId" TEXT,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" TIMESTAMP(3),

    CONSTRAINT "SocialAccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialAccountLink_platform_handle_idx" ON "SocialAccountLink"("platform", "handle");

-- CreateIndex
CREATE INDEX "SocialAccountLink_platform_externalId_idx" ON "SocialAccountLink"("platform", "externalId");

-- CreateIndex
CREATE INDEX "SocialAccountLink_socialAccountId_idx" ON "SocialAccountLink"("socialAccountId");

-- AddForeignKey
ALTER TABLE "SocialAccountLink" ADD CONSTRAINT "SocialAccountLink_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccountLink" ADD CONSTRAINT "SocialAccountLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- History starts with the accounts linked today.
INSERT INTO "SocialAccountLink" ("id", "platform", "handle", "externalId", "socialAccountId", "userId", "email", "displayName", "linkedAt")
SELECT 'lnk_' || s."id", s."platform", lower(s."username"),
       CASE WHEN s."source" = 'OAUTH' THEN s."externalId" ELSE NULL END,
       s."id", u."id", u."email", p."displayName", s."createdAt"
FROM "SocialAccount" s
JOIN "InfluencerProfile" p ON p."id" = s."influencerId"
JOIN "User" u ON u."id" = p."userId";
