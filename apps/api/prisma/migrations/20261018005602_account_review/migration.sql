-- CreateEnum
CREATE TYPE "AccountReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "AccountReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SocialAccount_reviewStatus_idx" ON "SocialAccount"("reviewStatus");

-- Accounts of bloggers who were already approved were checked with their profile.
UPDATE "SocialAccount" s SET "reviewStatus" = 'APPROVED', "reviewedAt" = p."approvedAt"
FROM "InfluencerProfile" p
WHERE s."influencerId" = p."id" AND p."status" = 'APPROVED';
