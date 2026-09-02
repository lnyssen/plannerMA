// Export CSV du portail Subventions — mêmes lignes et le même calcul que
// subventions-view.tsx (computeDashboardRows), filtré aux mêmes deux
// catégories de financement (EP, Européen).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listProjectsWithBudget } from "@/lib/data/time-entries";
import { PROJECT_POLE_LABELS } from "@/lib/planning/labels";
import { toIsoDate } from "@/lib/planning/dates";
import { computeDashboardRows, formatDurationFr } from "@/lib/planning/time";

const GRANT_TYPES = ["EDUCATION_PERMANENTE", "EUROPEEN"] as const;
const PACE_LABEL = { ahead: "En avance", onTrack: "Dans les temps", behind: "En retard" };

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(",") + "\r\n";
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return new NextResponse("Non autorisé", { status: 401 });
  }

  const [projects, statuses] = await Promise.all([listProjectsWithBudget(), listTaskStatuses()]);
  const allStatuses = statuses.map((s) => ({ position: s.position, isDone: s.isDone }));
  const rows = computeDashboardRows(
    projects
      .filter((p) => (GRANT_TYPES as readonly string[]).includes(p.pole ?? ""))
      .map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        pole: p.pole,
        budgetHours: p.budgetHours!,
        timeEntries: [...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)],
        taskStatuses: p.tasks.map((t) => t.status),
      })),
    allStatuses,
  );

  const header = ["Catégorie", "Client", "Projet", "Budget_h", "Réalisé_h", "Consommé_%", "Avancement_%", "Rythme"];
  let csv = csvRow(header);

  for (const r of rows) {
    csv += csvRow([
      r.pole ? PROJECT_POLE_LABELS[r.pole] : "",
      r.clientName,
      r.name,
      formatDurationFr(r.budgetMinutes),
      formatDurationFr(r.actualMinutes),
      Math.round(r.consumedRatio * 100).toString(),
      Math.round(r.progress * 100).toString(),
      PACE_LABEL[r.pace],
    ]);
  }

  return new NextResponse(String.fromCharCode(0xfeff) + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subventions-${toIsoDate(new Date())}.csv"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
