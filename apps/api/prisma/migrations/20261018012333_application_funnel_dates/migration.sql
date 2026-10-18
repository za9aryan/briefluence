-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "shortlistedAt" TIMESTAMP(3);


-- Backfill from the current status (best available history for existing rows).
UPDATE "Application" SET "shortlistedAt" = "updatedAt" WHERE "status" = 'SHORTLISTED';
UPDATE "Application" SET "acceptedAt" = "updatedAt" WHERE "status" IN ('ACCEPTED', 'COMPLETED');
