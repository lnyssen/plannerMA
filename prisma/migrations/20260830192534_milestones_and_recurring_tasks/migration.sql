-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurrence_frequency" "RecurrenceFrequency",
ADD COLUMN     "recurrence_interval" INTEGER,
ADD COLUMN     "recurrence_parent_id" TEXT,
ADD COLUMN     "recurrence_until" DATE;

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestones_project_id_idx" ON "milestones"("project_id");

-- CreateIndex
CREATE INDEX "tasks_recurrence_parent_id_idx" ON "tasks"("recurrence_parent_id");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_parent_id_fkey" FOREIGN KEY ("recurrence_parent_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
