-- CreateEnum
CREATE TYPE "MonthlyRecurrenceMode" AS ENUM ('BY_DATE', 'BY_WEEKDAY');

-- AlterEnum
ALTER TYPE "RecurrenceFrequency" ADD VALUE 'DAILY';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurrence_monthly_mode" "MonthlyRecurrenceMode";
