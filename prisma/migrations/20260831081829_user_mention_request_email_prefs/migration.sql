-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notify_on_mention" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notify_on_request" BOOLEAN NOT NULL DEFAULT true;
