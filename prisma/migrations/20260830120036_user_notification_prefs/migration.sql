-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notify_daily_digest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_on_assignment" BOOLEAN NOT NULL DEFAULT true;
