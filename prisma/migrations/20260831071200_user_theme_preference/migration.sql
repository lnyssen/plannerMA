-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "theme" "ThemePreference" NOT NULL DEFAULT 'LIGHT';
