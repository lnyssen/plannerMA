import type { ProjectType } from "@prisma/client";

interface EntryWithContext {
  task: { title: string } | null;
  project: { name: string; client: { name: string } } | null;
  category: { name: string } | null;
}

/** Équivalent texte brut de EntryContextLabelParts (voir components/ui/task-context-label.tsx) — pour un attribut `title`. */
export function entryContextLabel(entry: EntryWithContext): string {
  const tail = entry.task ? entry.task.title : (entry.category?.name ?? "Sans catégorie");
  if (!entry.project) return `AGENCE — ${tail}`;
  return `${entry.project.client.name} — ${entry.project.name} — ${tail}`;
}

/** Libellés FR de ProjectType (nomenclature de suivi de temps) — voir prisma/schema.prisma. */
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  EXTERNE: "Externe",
  EQUIPE_EDUCATIVE: "Équipe éducative",
  EUROPEEN: "Européen",
  FONCTIONNEMENT: "Fonctionnement",
  EP: "Éducation permanente",
};

/** Heure locale-affichage (le stockage reste UTC, voir dates.ts) au format "9h05". */
export function formatHourMinute(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
