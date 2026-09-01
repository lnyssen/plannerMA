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
export type NavCountKey = "mesTaches" | "demandes" | "tasksLate" | "projectsOverBudget";

export type NavGroup = "Travail" | "Projets" | "Suivi" | "Équipe" | "Système";

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
  tasksLate: number;
  projectsOverBudget: number;
}

/**
 * Ce que représente chaque puce et comment la mettre en forme — un nombre nu
 * à côté d'un libellé de menu ne se comprend pas de lui-même (relevé :
 * "à quoi correspond le numéro inscrit ?"). `describe` alimente l'infobulle
 * dans tous les états (replié ET déplié, avant seulement replié) ;
 * `alert` distingue un problème à corriger (retard, dépassement — teinte
 * alerte) d'un simple compte informatif (charge de travail, file d'attente —
 * teinte neutre), pour que la couleur porte aussi du sens.
 */
export const NAV_COUNT_META: Record<NavCountKey, { describe: (count: number) => string; alert: boolean }> = {
  tasksLate: {
    describe: (n) => `${n} tâche${n > 1 ? "s" : ""} en retard — échéance dépassée, pas encore terminée${n > 1 ? "s" : ""}`,
    alert: true,
  },
  projectsOverBudget: {
    describe: (n) => `${n} projet${n > 1 ? "s" : ""} qui dépasse${n > 1 ? "nt" : ""} son budget de temps`,
    alert: true,
  },
  mesTaches: {
    describe: (n) => `${n} tâche${n > 1 ? "s" : ""} qui vous ${n > 1 ? "sont" : "est"} attribuée${n > 1 ? "s" : ""}, pas encore terminée${n > 1 ? "s" : ""}`,
    alert: false,
  },
  demandes: {
    describe: (n) => `${n} demande${n > 1 ? "s" : ""} en attente de traitement`,
    alert: false,
  },
};

// Ordre par défaut, conforme à la maquette Claude Design (5 écrans conçus :
// Semaine, Projets, Tâches, Équipe, Réglages) + les écrans ajoutés depuis
// avec le même système visuel. Un utilisateur peut personnaliser cet ordre
// (voir NavOrderModal) ; ce tableau reste la référence pour les entrées non
// encore réordonnées et pour filtrer par rôle.
export const NAV_ENTRIES: NavEntry[] = [
  { href: "/aujourdhui", label: "Aujourd’hui", icon: Home, adminOnly: false, group: "Travail" },
  { href: "/taches", label: "Tâches", icon: Table2, adminOnly: false, countKey: "tasksLate", group: "Travail" },
  { href: "/mes-taches", label: "Mes tâches", icon: CheckSquare, adminOnly: false, countKey: "mesTaches", group: "Travail" },
  { href: "/planning", label: "Planning", icon: Columns3, adminOnly: false, group: "Travail" },
  { href: "/projets", label: "Projets", icon: ListChecks, adminOnly: false, countKey: "projectsOverBudget", group: "Projets" },
  { href: "/clients", label: "Clients", icon: Building2, adminOnly: false, group: "Projets" },
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: true, group: "Suivi" },
  { href: "/subventions", label: "Projets EP/Européens", icon: Landmark, adminOnly: true, group: "Suivi" },
  { href: "/temps", label: "Temps", icon: Clock, adminOnly: false, group: "Suivi" },
  { href: "/charge", label: "Charge", icon: Activity, adminOnly: true, group: "Suivi" },
  { href: "/equipe", label: "Équipe", icon: Users, adminOnly: false, group: "Équipe" },
  { href: "/demandes", label: "Demandes", icon: ClipboardList, adminOnly: true, countKey: "demandes", group: "Équipe" },
  { href: "/reglages", label: "Réglages", icon: Settings, adminOnly: true, group: "Système" },
  { href: "/aide", label: "Documentation", icon: HelpCircle, adminOnly: false, group: "Système" },
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
