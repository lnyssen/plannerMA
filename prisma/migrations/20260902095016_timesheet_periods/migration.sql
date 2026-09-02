-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateTable
CREATE TABLE "timesheet_periods" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_periods_status_idx" ON "timesheet_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_periods_person_id_month_key" ON "timesheet_periods"("person_id", "month");

-- AddForeignKey
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_periods" ADD CONSTRAINT "timesheet_periods_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
