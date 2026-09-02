-- Le client porte sa nature (interne/externe), le projet porte la sienne
-- (nature du travail) et son financement.
--
-- Avant : `projects.type` disait interne/externe alors que c'est une
-- propriété du client — deux projets d'un même client pouvaient se
-- contredire — et `projects.project_type` mélangeait trois questions
-- (pour qui, quelle nature, quel financement) dans un seul champ.

-- CreateEnum
CREATE TYPE "ProjectNature" AS ENUM ('FONCTIONNEMENT', 'EQUIPE_EDUCATIVE');
CREATE TYPE "ProjectFunding" AS ENUM ('AUCUN', 'EP', 'EUROPEEN');

-- AlterTable : nouvelles colonnes, remplies avant toute suppression.
ALTER TABLE "clients" ADD COLUMN "type" "ClientType" NOT NULL DEFAULT 'EXTERNAL';
ALTER TABLE "projects" ADD COLUMN "nature" "ProjectNature";
ALTER TABLE "projects" ADD COLUMN "funding" "ProjectFunding" NOT NULL DEFAULT 'AUCUN';

-- Reprise : la nature du client est celle de ses projets. Vérifié avant
-- migration — aucun client n'a de projets qui se contredisent ; en cas
-- d'égalité, INTERNAL l'emporte (min() sur le texte), le cas ne se
-- présentant pas dans les données.
UPDATE "clients" c
SET "type" = sub."t"::"ClientType"
FROM (SELECT "client_id", MIN("type"::text) AS "t" FROM "projects" GROUP BY "client_id") sub
WHERE c."id" = sub."client_id";

-- Reprise : project_type se scinde en nature + financement.
UPDATE "projects" SET "nature" = 'FONCTIONNEMENT'    WHERE "project_type" = 'FONCTIONNEMENT';
UPDATE "projects" SET "nature" = 'EQUIPE_EDUCATIVE'  WHERE "project_type" = 'EQUIPE_EDUCATIVE';
UPDATE "projects" SET "funding" = 'EP'               WHERE "project_type" = 'EP';
UPDATE "projects" SET "funding" = 'EUROPEEN'         WHERE "project_type" = 'EUROPEEN';
-- 'EXTERNE' ne devient rien : l'information est désormais portée par le client.

-- DropColumn : après reprise uniquement.
ALTER TABLE "projects" DROP COLUMN "type";
ALTER TABLE "projects" DROP COLUMN "project_type";

-- DropEnum : plus aucune colonne ne s'y réfère.
DROP TYPE "ProjectType";
