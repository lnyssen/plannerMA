-- Tâche → plusieurs studios, sans hiérarchie (voir TaskStudio) — même
-- principe que Project/ProjectStudio, déjà en place.

-- CreateTable
CREATE TABLE "task_studios" (
    "task_id" TEXT NOT NULL,
    "studio_id" TEXT NOT NULL,

    CONSTRAINT "task_studios_pkey" PRIMARY KEY ("task_id", "studio_id")
);

-- Copie des données existantes : chaque tâche garde son studio actuel comme
-- premier (et pour l'instant seul) membre de la nouvelle relation, avant de
-- retirer l'ancienne colonne — sans cette étape, l'historique des
-- affectations serait perdu.
INSERT INTO "task_studios" ("task_id", "studio_id")
SELECT "id", "studio_id" FROM "tasks" WHERE "studio_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "task_studios" ADD CONSTRAINT "task_studios_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_studios" ADD CONSTRAINT "task_studios_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_studio_id_fkey";

-- DropIndex
DROP INDEX "tasks_studio_id_idx";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "studio_id";
