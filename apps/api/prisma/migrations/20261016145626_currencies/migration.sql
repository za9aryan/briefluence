-- AlterEnum
ALTER TYPE "Currency" ADD VALUE 'RUB';

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "currency" "Currency" NOT NULL,
    "amdPerUnit" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency")
);
