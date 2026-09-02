-- Un seul champ « pôle » au lieu de nature + financement.
--
-- Éducation permanente et Européen avaient été rangés comme des catégories
-- de financement. Ce sont en réalité des pôles internes, au même titre
-- qu'Équipe éducative : des collègues. Les deux champs décrivaient donc la
-- même chose — quelle équipe porte le projet — et se répondaient mal (un
-- projet ne pouvait pas être à la fois « Fonctionnement » et « Européen »).
--
-- Un pôle peut mener un projet pour un commanditaire externe : le pôle
-- Éducation permanente en mène un pour la Ligue des familles. D'où un champ
-- distinct du client, qui reste porteur de l'interne/externe.

-- CreateEnum
CREATE TYPE "ProjectPole" AS ENUM ('FONCTIONNEMENT', 'EQUIPE_EDUCATIVE', 'EDUCATION_PERMANENTE', 'EUROPEEN');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "pole" "ProjectPole";

-- Reprise : le financement l'emporte quand les deux sont renseignés, un
-- projet EP ou Européen étant porté par ce pôle-là.
UPDATE "projects" SET "pole" = 'EDUCATION_PERMANENTE' WHERE "funding" = 'EP';
UPDATE "projects" SET "pole" = 'EUROPEEN'             WHERE "funding" = 'EUROPEEN';
UPDATE "projects" SET "pole" = "nature"::text::"ProjectPole" WHERE "pole" IS NULL AND "nature" IS NOT NULL;

-- DropColumn
ALTER TABLE "projects" DROP COLUMN "nature";
ALTER TABLE "projects" DROP COLUMN "funding";

-- DropEnum
DROP TYPE "ProjectNature";
DROP TYPE "ProjectFunding";
