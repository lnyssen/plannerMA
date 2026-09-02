/**
 * Règles de correspondance entre Studio planner et Clockify, isolées de tout
 * accès réseau ou base pour rester vérifiables par des tests.
 */

/**
 * Nom d'un projet côté Clockify.
 *
 * Le code du projet est préfixé quand il existe : dans Clockify, la liste
 * déroulante de saisie ne montre que le nom, et deux projets homonymes chez
 * deux clients y deviennent indiscernables. Le client, lui, est porté par le
 * champ dédié de Clockify, pas répété dans le nom.
 */
export function clockifyProjectName(project: { name: string; code: string | null }): string {
  return project.code ? `[${project.code}] ${project.name}` : project.name;
}

/** Bornes ISO d'un mois, au format attendu par l'API (UTC, secondes incluses). */
export function monthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, m - 1, 1)).toISOString().replace(/\.\d{3}Z$/, "Z"),
    end: new Date(Date.UTC(year, m, 1)).toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

export interface ImportableEntry {
  id: string;
  description: string;
  projectId: string | null;
  timeInterval: { start: string; end: string | null };
}

export interface ImportDecision {
  /** L'écriture est retenue pour import. */
  keep: boolean;
  /** Pourquoi elle est écartée — affiché tel quel dans le rapport d'import. */
  reason?: string;
}

/**
 * Faut-il importer cette écriture Clockify ?
 *
 * Trois refus, dans cet ordre :
 *
 * 1. **Minuteur en cours** — sans fin, sa durée changerait à chaque import.
 * 2. **Déjà importée** — l'identifiant Clockify sert de clé d'idempotence,
 *    sans quoi réimporter une période doublerait les heures.
 * 3. **Projet inconnu** — une écriture posée sur un projet Clockify qui n'a
 *    pas de contrepartie ici n'a nulle part où atterrir. On l'écarte en le
 *    disant, plutôt que de l'attacher au hasard : ces heures comptent pour
 *    un budget et pour des justificatifs de subvention.
 */
export function decideImport(
  entry: ImportableEntry,
  known: { alreadyImported: Set<string>; projectByClockifyId: Map<string, string> },
): ImportDecision {
  if (!entry.timeInterval.end) return { keep: false, reason: "minuteur encore en cours" };
  if (known.alreadyImported.has(entry.id)) return { keep: false, reason: "déjà importée" };
  if (!entry.projectId || !known.projectByClockifyId.has(entry.projectId)) {
    return { keep: false, reason: "projet Clockify sans correspondance dans le planner" };
  }
  return { keep: true };
}

/** Mois (AAAA-MM, UTC) auquel se rattache une écriture — décide du verrou de feuille de temps. */
export function monthKeyOfIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
