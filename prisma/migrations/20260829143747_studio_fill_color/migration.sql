-- AlterTable
-- Valeur temporaire pour les lignes existantes (données de démonstration) ;
-- le seed réécrit ensuite les vraies valeurs (fond clair + texte AA) pour
-- chaque studio.
ALTER TABLE "studios" ADD COLUMN     "fill_hex" TEXT NOT NULL DEFAULT '#EFEFEF';
ALTER TABLE "studios" ALTER COLUMN "fill_hex" DROP DEFAULT;
