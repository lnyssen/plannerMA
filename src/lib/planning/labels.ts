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

/** Heure locale-affichage (le stockage reste UTC, voir dates.ts) au format "9h05". */
export function formatHourMinute(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
