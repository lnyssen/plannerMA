-- Remplace l'énum figée TaskStatus (TODO/IN_PROGRESS/VALIDATION/DELIVERED)
-- par une table administrable (task_statuses), sur le modèle de studios :
-- un administrateur peut en ajouter, les renommer et les réordonner. Écrite
-- à la main (comme la migration de l'entité Client) car `prisma migrate dev`
-- refuse un changement destructif en environnement non interactif.
--
-- 1) Crée la table et y insère les quatre statuts existants, avec les
--    couleurs jusqu'ici codées en dur dans globals.css (--status-*-fill/text).
-- 2) Ajoute la colonne tasks.status_id (nullable), la remplit par
--    correspondance avec l'ancienne valeur d'énum, la rend obligatoire.
-- 3) Supprime l'ancienne colonne "status" et le type d'énum devenu inutile.

CREATE TABLE "task_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,
    "fill_hex" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_statuses_name_key" ON "task_statuses"("name");

INSERT INTO "task_statuses" ("id", "name", "color_hex", "fill_hex", "position", "is_done", "updated_at") VALUES
    (gen_random_uuid()::text, 'À faire', '#444444', '#f7f7fc', 0, false, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'En cours', '#612dfa', '#b9bbff', 1, false, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Validation', '#8a5a00', '#fdecd2', 2, false, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Livré', '#1c7a3d', '#dcf3e3', 3, true, CURRENT_TIMESTAMP);

ALTER TABLE "tasks" ADD COLUMN "status_id" TEXT;

UPDATE "tasks" SET "status_id" = (
    SELECT "id" FROM "task_statuses" WHERE "name" = CASE "tasks"."status"
        WHEN 'TODO' THEN 'À faire'
        WHEN 'IN_PROGRESS' THEN 'En cours'
        WHEN 'VALIDATION' THEN 'Validation'
        WHEN 'DELIVERED' THEN 'Livré'
    END
);

ALTER TABLE "tasks" ALTER COLUMN "status_id" SET NOT NULL;
ALTER TABLE "tasks" DROP COLUMN "status";
DROP TYPE "TaskStatus";

CREATE INDEX "tasks_status_id_idx" ON "tasks"("status_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_fkey"
    FOREIGN KEY ("status_id") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
