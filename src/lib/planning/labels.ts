import type { ProjectType } from "@prisma/client";

// Nomenclature unique pour identifier une tâche avec son contexte, utilisée
// partout où une tâche apparaît hors d'un tableau à colonnes séparées
// (select, carte, bulle, bloc de calendrier) — toujours dans l'ordre
// Client — Projet — Tâche, du plus général au plus précis.

interface TaskWithContext {
  title: string;
  project: { name: string; client: { name: string } } | null;
}

export function taskContextLabel(task: TaskWithContext): string {
  if (!task.project) return task.title;
  return `${task.project.client.name} — ${task.project.name} — ${task.title}`;
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

/**
 * Tri alphabétique Client → Projet → Tâche, insensible à la casse/accents —
 * partout où la nomenclature Client — Projet — Tâche est affichée (listes
 * déroulantes, calendrier…), l'ordre suit toujours ce critère plutôt que
 * l'ordre d'insertion en base. Les tâches sans projet sont classées en fin
 * de liste, triées par leur seul titre.
 */
export function sortByTaskContext<T extends TaskWithContext>(tasks: T[]): T[] {
  const collator = new Intl.Collator("fr", { sensitivity: "base" });
  return [...tasks].sort((a, b) => {
    if (!a.project && !b.project) return collator.compare(a.title, b.title);
    if (!a.project) return 1;
    if (!b.project) return -1;
    return (
      collator.compare(a.project.client.name, b.project.client.name) ||
      collator.compare(a.project.name, b.project.name) ||
      collator.compare(a.title, b.title)
    );
  });
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
