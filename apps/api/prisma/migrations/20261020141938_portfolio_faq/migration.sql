-- AlterTable
ALTER TABLE "InfluencerProfile" ADD COLUMN     "faqAudience" TEXT,
ADD COLUMN     "faqBrandsWanted" TEXT,
ADD COLUMN     "faqBrandsWorked" TEXT;

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "linkUrl" TEXT,
    "reviewStatus" "AccountReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ApplicationPortfolio" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ApplicationPortfolio_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "PortfolioItem_influencerId_idx" ON "PortfolioItem"("influencerId");

-- CreateIndex
CREATE INDEX "PortfolioItem_reviewStatus_idx" ON "PortfolioItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "_ApplicationPortfolio_B_index" ON "_ApplicationPortfolio"("B");

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "InfluencerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApplicationPortfolio" ADD CONSTRAINT "_ApplicationPortfolio_A_fkey" FOREIGN KEY ("A") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApplicationPortfolio" ADD CONSTRAINT "_ApplicationPortfolio_B_fkey" FOREIGN KEY ("B") REFERENCES "PortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

