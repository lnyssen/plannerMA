// Export CSV du tableau de bord (budget de temps vs réel) — mêmes lignes et
// le même calcul que dashboard-view.tsx (computeDashboardRows), pour un
// export toujours identique à ce qui est affiché.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listProjectsWithBudget } from "@/lib/data/time-entries";
import { toIsoDate } from "@/lib/planning/dates";
import { computeDashboardRows, formatDurationFr } from "@/lib/planning/time";

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
    projects.map((p) => ({
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

  const header = ["Client", "Projet", "Budget_h", "Réalisé_h", "Consommé_%", "Avancement_%", "Rythme"];
  let csv = csvRow(header);

  for (const r of rows) {
    csv += csvRow([
      r.clientName,
      r.name,
      formatDurationFr(r.budgetMinutes),
      formatDurationFr(r.actualMinutes),
      Math.round(r.consumedRatio * 100).toString(),
      Math.round(r.progress * 100).toString(),
      PACE_LABEL[r.pace],
    ]);
  }

  // BOM UTF-8 en tête : voir api/export/time-entries pour la même nécessité
  // (Excel Windows ignore sinon l'encodage déclaré et rouvre en page de code
  // système, illisible sur les accents).
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tableau-de-bord-${toIsoDate(new Date())}.csv"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
