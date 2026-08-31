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

/** Heure locale-affichage (le stockage reste UTC, voir dates.ts) au format "9h05". */
export function formatHourMinute(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
