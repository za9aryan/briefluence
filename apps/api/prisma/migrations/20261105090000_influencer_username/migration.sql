-- AlterTable
ALTER TABLE "InfluencerProfile" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InfluencerProfile_username_key" ON "InfluencerProfile"("username");
