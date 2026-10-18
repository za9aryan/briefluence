-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('BASIC', 'PRO_MONTHLY', 'PRO_YEARLY');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "planCode" "PlanCode";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "basicSince" TIMESTAMP(3),
ADD COLUMN     "planCode" "PlanCode" NOT NULL DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "Plan" (
    "code" "PlanCode" NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "applicationLimit" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("code")
);


-- Default plans (prices editable in Admin > Plans).
INSERT INTO "Plan" ("code", "priceMinor", "currency", "applicationLimit", "isActive") VALUES
  ('BASIC', 0, 'USD', 10, true),
  ('PRO_MONTHLY', 999, 'USD', NULL, true),
  ('PRO_YEARLY', 9999, 'USD', NULL, true);

-- Existing bloggers: free days → chose Basic (keeps remaining days); payers → Pro monthly; ended → Basic.
UPDATE "Subscription" SET "planCode" = 'PRO_MONTHLY' WHERE "status" IN ('ACTIVE', 'PAST_DUE', 'CANCELED');
UPDATE "Subscription" SET "status" = 'ACTIVE', "planCode" = 'BASIC', "currentPeriodEnd" = NULL,
  "cancelAtPeriodEnd" = false, "failedAttempts" = 0, "pastDueSince" = NULL, "basicSince" = now()
WHERE "status" = 'EXPIRED';
UPDATE "Payment" SET "planCode" = 'PRO_MONTHLY';
