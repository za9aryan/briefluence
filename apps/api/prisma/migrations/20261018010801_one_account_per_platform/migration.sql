-- DropIndex
DROP INDEX "SocialAccount_influencerId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_influencerId_platform_key" ON "SocialAccount"("influencerId", "platform");

