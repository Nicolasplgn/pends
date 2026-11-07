-- AlterTable
ALTER TABLE "RecurringTask" ADD COLUMN     "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'FINANCE',
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'Normal',
ADD COLUMN     "weekday" INTEGER;

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "saved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthly" DOUBLE PRECISION,
    "deadline" TIMESTAMP(3),
    "color" TEXT NOT NULL DEFAULT '#10B981',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

