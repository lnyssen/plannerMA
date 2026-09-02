-- Correspondances avec Clockify. Les quatre colonnes sont ajoutées vides :
-- l'index unique est donc sans risque sur les lignes existantes, PostgreSQL
-- ne considérant jamais deux NULL comme égaux.

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "clockify_id" TEXT;
ALTER TABLE "projects" ADD COLUMN "clockify_id" TEXT;
ALTER TABLE "people" ADD COLUMN "clockify_user_id" TEXT;
ALTER TABLE "time_entries" ADD COLUMN "clockify_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_clockify_id_key" ON "clients"("clockify_id");
CREATE UNIQUE INDEX "projects_clockify_id_key" ON "projects"("clockify_id");
CREATE UNIQUE INDEX "people_clockify_user_id_key" ON "people"("clockify_user_id");
CREATE UNIQUE INDEX "time_entries_clockify_id_key" ON "time_entries"("clockify_id");
