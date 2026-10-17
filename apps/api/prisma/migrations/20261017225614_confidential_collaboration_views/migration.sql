-- CreateEnum
CREATE TYPE "CollaborationType" AS ENUM ('ONE_TIME', 'LONG_TERM');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "collaborationType" "CollaborationType" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "isConfidential" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FeedSearch" ADD COLUMN     "collaborationTypes" "CollaborationType"[];

-- CreateTable
CREATE TABLE "DealView" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealView_dealId_createdAt_idx" ON "DealView"("dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealView_dealId_influencerId_day_key" ON "DealView"("dealId", "influencerId", "day");

-- AddForeignKey
ALTER TABLE "DealView" ADD CONSTRAINT "DealView_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
