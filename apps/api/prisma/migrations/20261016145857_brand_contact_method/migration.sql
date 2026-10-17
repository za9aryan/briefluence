-- Brand contact person: name + optional position + one contact method with its value.
CREATE TYPE "ContactMethod" AS ENUM ('TELEGRAM', 'MESSENGER', 'VIBER', 'WHATSAPP', 'INSTAGRAM', 'PHONE');

ALTER TABLE "BrandProfile"
  ADD COLUMN "contactMethod" "ContactMethod",
  ADD COLUMN "contactPosition" TEXT,
  ADD COLUMN "contactValue" TEXT;

-- Keep existing contacts: phone numbers become the PHONE method (normalized to +digits).
UPDATE "BrandProfile"
SET "contactMethod" = 'PHONE',
    "contactValue" = '+' || regexp_replace("contactPhone", '\D', '', 'g')
WHERE "contactPhone" IS NOT NULL AND length(regexp_replace("contactPhone", '\D', '', 'g')) >= 7;

ALTER TABLE "BrandProfile" DROP COLUMN "contactEmail", DROP COLUMN "contactPhone";
