-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REJECTED', 'ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OfferRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "offerLimit" INTEGER;

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceMinor" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'AMD',
    "collaborationType" "CollaborationType" NOT NULL DEFAULT 'ONE_TIME',
    "platforms" "Platform"[],
    "contentFormats" "ContentFormat"[],
    "niches" TEXT[],
    "idealBrands" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "approvedKey" TEXT,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferRequest" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "proposedBudget" INTEGER,
    "status" "OfferRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferView" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_status_publishedAt_idx" ON "Offer"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Offer_influencerId_idx" ON "Offer"("influencerId");

-- CreateIndex
CREATE INDEX "OfferRequest_brandId_idx" ON "OfferRequest"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferRequest_offerId_brandId_key" ON "OfferRequest"("offerId", "brandId");

-- CreateIndex
CREATE INDEX "OfferView_offerId_createdAt_idx" ON "OfferView"("offerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferView_offerId_brandId_day_key" ON "OfferView"("offerId", "brandId", "day");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRequest" ADD CONSTRAINT "OfferRequest_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRequest" ADD CONSTRAINT "OfferRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferView" ADD CONSTRAINT "OfferView_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferView" ADD CONSTRAINT "OfferView_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Basic: 1 live offer; Pro: unlimited.
UPDATE "Plan" SET "offerLimit" = 1 WHERE "code" = 'BASIC';
