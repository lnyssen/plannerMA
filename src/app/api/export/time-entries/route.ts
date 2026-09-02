// Export CSV des écritures de temps — colonnes alignées sur la nomenclature
// "Suivi hebdo du temps de travail" transmise par l'équipe (Date, Studio,
// Projet, Type de projet, Type de tâche, Heures, Note), avec la personne en
// tête puisque c'est un export toutes personnes confondues (réservé aux
// administrateurs, comme la vue "Équipe" de Temps).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { toIsoDate } from "@/lib/planning/dates";
import { PROJECT_POLE_LABELS } from "@/lib/planning/labels";

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

  const entries = await db.timeEntry.findMany({
    where: { endedAt: { not: null } },
    orderBy: { startedAt: "asc" },
    include: {
      person: { select: { name: true } },
      studio: { select: { name: true } },
      project: { select: { name: true, code: true, pole: true, client: { select: { type: true } } } },
      category: { select: { name: true } },
    },
  });

  const header = ["Personne", "Date", "Studio", "Projet", "Client", "Pôle", "Type_tâche", "Heures", "Note"];
  let csv = csvRow(header);

  for (const e of entries) {
    const hours = ((e.endedAt!.getTime() - e.startedAt.getTime()) / 3_600_000).toFixed(2);
    const projet = e.project ? (e.project.code || e.project.name) : "AGENCE";
    // Trois colonnes distinctes remplacent l'ancienne « type de projet », qui
    // mélangeait le client, la nature du travail et le financement.
    const clientInterne = e.project ? e.project.client.type === "INTERNAL" : true;
    const pole = e.project?.pole ? PROJECT_POLE_LABELS[e.project.pole] : "";
    csv += csvRow([
      e.person.name,
      toIsoDate(e.startedAt),
      e.studio.name,
      projet,
      clientInterne ? "Interne" : "Externe",
      pole,
      e.category?.name ?? "",
      hours,
      e.note ?? "",
    ]);
  }

  // BOM UTF-8 en tête : sans lui, Excel (notamment sous Windows) ignore
  // l'encodage déclaré dans l'en-tête HTTP et rouvre le fichier avec la page
  // de code du système — les accents (Média, Réunion...) deviennent
  // illisibles. Le BOM force la détection UTF-8 à l'ouverture, sans gêner
  // les autres lecteurs de CSV.
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="suivi-temps-${toIsoDate(new Date())}.csv"`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  });
}
