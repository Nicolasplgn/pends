-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "assignee" TEXT;

-- CreateTable
CREATE TABLE "CardArchive" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "moduleTitle" TEXT,
    "moduleColor" TEXT,
    "assignee" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardArchive_archivedAt_idx" ON "CardArchive"("archivedAt");

