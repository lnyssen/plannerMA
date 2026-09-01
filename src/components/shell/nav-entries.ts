import {
  Activity,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock,
  Columns3,
  HelpCircle,
  Home,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Settings,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Clé vers un compteur calculé côté serveur (voir NavCounts) — absent = pas de puce. */
export type NavCountKey = "mesTaches" | "demandes" | "tasksActive" | "projectsActive";

export type NavGroup = "Travail" | "Projets" | "Suivi" | "Équipe" | "Paramètres";

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  countKey?: NavCountKey;
  /** Regroupement affiché dans l'ordre par défaut — masqué dès que l'utilisateur personnalise son ordre (voir applyNavOrder/renderNav), qui peut mélanger les groupes. */
  group: NavGroup;
}

/** Compteurs affichés en puce sur les entrées correspondantes — voir (app)/layout.tsx. */
export interface NavCounts {
  mesTaches: number;
  demandes: number;
  tasksActive: number;
  /** Sous-ensemble de tasksActive (échéance dépassée) — pas sa propre puce, sert juste à colorer celle de tasksActive en alerte. */
  tasksLate: number;
  projectsActive: number;
  /** Sous-ensemble de projectsActive (budget de temps dépassé) — même principe que tasksLate. */
  projectsOverBudget: number;
}

/**
 * Ce que représente chaque puce et comment la mettre en forme — un nombre nu
 * à côté d'un libellé de menu ne se comprend pas de lui-même (relevé :
 * "à quoi correspond le numéro inscrit ?"). `describe` alimente l'infobulle
 * dans tous les états (replié ET déplié, avant seulement replié) ; `alert`
 * distingue un problème à corriger (teinte alerte) d'un simple compte
 * informatif (teinte neutre). Le nombre affiché est toujours un total
 * informatif (tâches/projets en cours) ; `alert` s'active séparément dès
 * qu'un sous-ensemble à problème existe dans ce total (retard, dépassement
 * de budget) — pour ne pas avoir à choisir entre "montrer combien" et
 * "signaler un problème", les deux se lisent d'un coup d'œil.
 */
export const NAV_COUNT_META: Record<
  NavCountKey,
  { describe: (count: number, counts: NavCounts) => string; alert: (counts: NavCounts) => boolean }
> = {
  tasksActive: {
    describe: (n, counts) =>
      `${n} tâche${n > 1 ? "s" : ""} en cours` +
      (counts.tasksLate > 0 ? ` — dont ${counts.tasksLate} en retard` : ""),
    alert: (counts) => counts.tasksLate > 0,
  },
  projectsActive: {
    describe: (n, counts) =>
      `${n} projet${n > 1 ? "s" : ""} en cours` +
      (counts.projectsOverBudget > 0
        ? ` — dont ${counts.projectsOverBudget} qui dépasse${counts.projectsOverBudget > 1 ? "nt" : ""} son budget de temps`
        : ""),
    alert: (counts) => counts.projectsOverBudget > 0,
  },
  mesTaches: {
    describe: (n) => `${n} tâche${n > 1 ? "s" : ""} qui vous ${n > 1 ? "sont" : "est"} attribuée${n > 1 ? "s" : ""}, pas encore terminée${n > 1 ? "s" : ""}`,
    alert: () => false,
  },
  demandes: {
    describe: (n) => `${n} demande${n > 1 ? "s" : ""} en attente de traitement`,
    alert: () => false,
  },
};

// Ordre par défaut, conforme à la maquette Claude Design (5 écrans conçus :
// Semaine, Projets, Tâches, Équipe, Réglages) + les écrans ajoutés depuis
// avec le même système visuel. Un utilisateur peut personnaliser cet ordre
// (voir NavOrderModal) ; ce tableau reste la référence pour les entrées non
// encore réordonnées et pour filtrer par rôle.
export const NAV_ENTRIES: NavEntry[] = [
  { href: "/aujourdhui", label: "Aujourd’hui", icon: Home, adminOnly: false, group: "Travail" },
  { href: "/taches", label: "Tâches", icon: Table2, adminOnly: false, countKey: "tasksActive", group: "Travail" },
  { href: "/mes-taches", label: "Mes tâches", icon: CheckSquare, adminOnly: false, countKey: "mesTaches", group: "Travail" },
  { href: "/planning", label: "Planning", icon: Columns3, adminOnly: false, group: "Travail" },
  { href: "/projets", label: "Projets", icon: ListChecks, adminOnly: false, countKey: "projectsActive", group: "Projets" },
  { href: "/clients", label: "Clients", icon: Building2, adminOnly: false, group: "Projets" },
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: true, group: "Suivi" },
  { href: "/subventions", label: "Projets EP/Européens", icon: Landmark, adminOnly: true, group: "Suivi" },
  { href: "/temps", label: "Temps", icon: Clock, adminOnly: false, group: "Suivi" },
  { href: "/charge", label: "Charge", icon: Activity, adminOnly: true, group: "Suivi" },
  { href: "/equipe", label: "Équipe", icon: Users, adminOnly: false, group: "Équipe" },
  { href: "/demandes", label: "Demandes", icon: ClipboardList, adminOnly: true, countKey: "demandes", group: "Équipe" },
  { href: "/reglages", label: "Réglages", icon: Settings, adminOnly: true, group: "Paramètres" },
  { href: "/aide", label: "Documentation", icon: HelpCircle, adminOnly: false, group: "Paramètres" },
];

/** Décode `User.navOrder` (JSON stocké en base) — `null` si absent ou invalide. */
export function parseNavOrder(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) return parsed;
  } catch {
    // JSON invalide (ne devrait pas arriver, seul updateNavOrder écrit ce champ) — repli sur l'ordre par défaut.
  }
  return null;
}

/**
 * Applique un ordre personnalisé (tableau de `href`, depuis `User.navOrder`)
 * à la liste d'entrées déjà filtrée par rôle : les entrées listées dans
 * `order` sortent dans cet ordre, celles non listées (nouvel écran ajouté
 * depuis la personnalisation, ou état par défaut) suivent dans leur ordre
 * d'origine.
 */
export function applyNavOrder(entries: NavEntry[], order: string[] | null): NavEntry[] {
  if (!order || order.length === 0) return entries;
  const rank = new Map(order.map((href, i) => [href, i]));
  return [...entries].sort((a, b) => {
    const ra = rank.has(a.href) ? rank.get(a.href)! : order.length + entries.indexOf(a);
    const rb = rank.has(b.href) ? rank.get(b.href)! : order.length + entries.indexOf(b);
    return ra - rb;
  });
}
