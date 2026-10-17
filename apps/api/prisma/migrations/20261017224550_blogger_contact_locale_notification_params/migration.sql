-- Language for emails / notifications.
ALTER TABLE "User" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';

-- Notifications keep raw values so the text can be shown in the reader's language.
ALTER TABLE "Notification" ADD COLUMN "params" JSONB;

-- Blogger contact: one method + value (like brands).
ALTER TABLE "InfluencerProfile"
  ADD COLUMN "contactMethod" "ContactMethod",
  ADD COLUMN "contactValue" TEXT;

-- Keep existing contacts: a Telegram handle wins, otherwise the phone number.
UPDATE "InfluencerProfile"
SET "contactMethod" = 'TELEGRAM', "contactValue" = regexp_replace(trim("telegram"), '^@', '')
WHERE "telegram" IS NOT NULL AND trim("telegram") <> '';

UPDATE "InfluencerProfile"
SET "contactMethod" = 'PHONE', "contactValue" = '+' || regexp_replace("contactPhone", '\D', '', 'g')
WHERE "contactMethod" IS NULL AND "contactPhone" IS NOT NULL
  AND length(regexp_replace("contactPhone", '\D', '', 'g')) >= 7;

ALTER TABLE "InfluencerProfile" DROP COLUMN "contactEmail", DROP COLUMN "contactPhone", DROP COLUMN "telegram";
