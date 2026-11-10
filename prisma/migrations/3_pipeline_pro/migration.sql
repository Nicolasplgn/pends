-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "blockedById" TEXT,
ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "estimateHours" DOUBLE PRECISION,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "spentMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "timerStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CardArchive" ADD COLUMN     "projectTitle" TEXT,
ADD COLUMN     "spentMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Column" ADD COLUMN     "kind" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8B5CF6',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

