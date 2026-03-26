-- CreateEnum
CREATE TYPE "AiProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SearchIndexStatus" AS ENUM ('PENDING', 'INDEXED_BASE', 'INDEXED_ENRICHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'ALLOW', 'REVIEW', 'REJECT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionState" ADD VALUE 'AI_PROCESSING';
ALTER TYPE "TransactionState" ADD VALUE 'REJECTED_MODERATION';
ALTER TYPE "TransactionState" ADD VALUE 'READY';
ALTER TYPE "TransactionState" ADD VALUE 'FAILED';

-- DropIndex
DROP INDEX "transactions_state_idx";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "aiModelVersion" TEXT,
ADD COLUMN     "aiPromptVersion" TEXT,
ADD COLUMN     "aiStatus" "AiProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "improvedDescription" TEXT,
ADD COLUMN     "moderationConfidence" DECIMAL(5,2),
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "riskNarrative" TEXT,
ADD COLUMN     "riskScore" DECIMAL(5,2),
ADD COLUMN     "searchStatus" "SearchIndexStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "searchTags" JSONB,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "transactions_state_createdAt_idx" ON "transactions"("state", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_aiStatus_createdAt_idx" ON "transactions"("aiStatus", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_searchStatus_createdAt_idx" ON "transactions"("searchStatus", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_moderationStatus_createdAt_idx" ON "transactions"("moderationStatus", "createdAt");
