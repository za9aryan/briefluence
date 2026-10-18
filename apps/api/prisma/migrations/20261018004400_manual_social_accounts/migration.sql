-- CreateEnum
CREATE TYPE "AccountSource" AS ENUM ('OAUTH', 'MANUAL');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "source" "AccountSource" NOT NULL DEFAULT 'OAUTH',
ALTER COLUMN "accessTokenEnc" DROP NOT NULL;
