-- CreateTable
CREATE TABLE "FeedSearch" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platforms" "Platform"[],
    "niches" TEXT[],
    "cities" TEXT[],
    "paymentTypes" "PaymentType"[],
    "budgetMin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedSearch_createdAt_idx" ON "FeedSearch"("createdAt");

-- CreateIndex
CREATE INDEX "FeedSearch_influencerId_createdAt_idx" ON "FeedSearch"("influencerId", "createdAt");
