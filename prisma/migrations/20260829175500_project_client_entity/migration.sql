-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_name_key" ON "clients"("name");

-- Backfill: un Client par valeur distincte de projects.client existante,
-- pour ne perdre aucune donnée de démonstration/réelle déjà saisie.
INSERT INTO "clients" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid()::text, d."client", now(), now()
FROM (SELECT DISTINCT "client" FROM "projects") AS d;

-- AlterTable: colonne nullable le temps du rattachement, puis rendue requise
ALTER TABLE "projects" ADD COLUMN "client_id" TEXT;

UPDATE "projects" p SET "client_id" = c."id"
FROM "clients" c
WHERE c."name" = p."client";

ALTER TABLE "projects" ALTER COLUMN "client_id" SET NOT NULL;
ALTER TABLE "projects" DROP COLUMN "client";

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
