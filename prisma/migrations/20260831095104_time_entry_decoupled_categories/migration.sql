/*
  Warnings:

  - Added the required column `studio_id` to the `time_entries` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('EXTERNE', 'EQUIPE_EDUCATIVE', 'EUROPEEN', 'FONCTIONNEMENT');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "code" TEXT,
ADD COLUMN     "project_type" "ProjectType" NOT NULL DEFAULT 'EXTERNE';

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "studio_id" TEXT,
ALTER COLUMN "task_id" DROP NOT NULL;

-- Backfill studio_id (and project_id where the task had one) from the
-- linked task for existing rows — every pre-existing entry was task-linked,
-- so studio_id always resolves.
UPDATE "time_entries" te
SET "studio_id" = t."studio_id", "project_id" = t."project_id"
FROM "tasks" t
WHERE te."task_id" = t.id AND te."studio_id" IS NULL;

ALTER TABLE "time_entries" ALTER COLUMN "studio_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "task_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studio_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_categories_studio_id_name_key" ON "task_categories"("studio_id", "name");

-- CreateIndex
CREATE INDEX "time_entries_project_id_idx" ON "time_entries"("project_id");

-- AddForeignKey
ALTER TABLE "task_categories" ADD CONSTRAINT "task_categories_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "task_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
