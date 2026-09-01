-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notify_on_comment" BOOLEAN NOT NULL DEFAULT true;
