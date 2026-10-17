-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContentFormat" ADD VALUE 'TEXT_MENTION';
ALTER TYPE "ContentFormat" ADD VALUE 'INTEGRATION';
ALTER TYPE "ContentFormat" ADD VALUE 'PRODUCT_PLACEMENT';
ALTER TYPE "ContentFormat" ADD VALUE 'REVIEW';
ALTER TYPE "ContentFormat" ADD VALUE 'GIVEAWAY';
ALTER TYPE "ContentFormat" ADD VALUE 'EVENT';
ALTER TYPE "ContentFormat" ADD VALUE 'UGC';
