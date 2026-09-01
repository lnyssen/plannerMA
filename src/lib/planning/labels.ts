import type { ProjectType } from "@prisma/client";

/**
 * Couleur d'une barre/bloc de tâche selon ses studios — un seul garde
 * l'aplat plein habituel ; plusieurs studios (voir TaskStudio, aucune
 * hiérarchie entre eux) se partagent la largeur en bandes égales plutôt que
 * d'en privilégier un seul. Partagé entre Gantt et Semaine.
 */
export function studioBarStyle(
  studios: { studio: { fillHex: string; colorHex: string } }[],
): { background: string; color: string } {
  if (studios.length <= 1) {
    const s = studios[0]?.studio;
    return { background: s?.fillHex ?? "var(--color-wash)", color: s?.colorHex ?? "var(--color-ink)" };
  }
  const stops = studios
    .map(({ studio }, i) => {
      const from = (i / studios.length) * 100;
      const to = ((i + 1) / studios.length) * 100;
      return `${studio.fillHex} ${from}% ${to}%`;
    })
    .join(", ");
  return { background: `linear-gradient(90deg, ${stops})`, color: studios[0].studio.colorHex };
}

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
