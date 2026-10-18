-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DealStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "DealStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "approvedKey" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Deal_status_submittedAt_idx" ON "Deal"("status", "submittedAt");
