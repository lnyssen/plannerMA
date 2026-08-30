-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "task_id" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "estimated_half_days" INTEGER;

-- CreateIndex
CREATE INDEX "journal_entries_task_id_idx" ON "journal_entries"("task_id");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
