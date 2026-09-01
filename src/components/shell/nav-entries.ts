import {
  Activity,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock,
  Columns3,
  LayoutDashboard,
  ListChecks,
  Settings,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Clé vers un compteur calculé côté serveur (voir NavCounts) — absent = pas de puce. */
export type NavCountKey = "mesTaches" | "demandes" | "tasksLate" | "projectsOverBudget";

export type NavGroup = "Travail" | "Projets" | "Suivi" | "Équipe";

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  /** Un responsable de studio y accède aussi (vue limitée à son studio), même si `adminOnly` est vrai. */
  studioLeadOk?: boolean;
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

// Ordre par défaut, conforme à la maquette Claude Design (5 écrans conçus :
// Semaine, Projets, Tâches, Équipe, Réglages) + les écrans ajoutés depuis
// avec le même système visuel. Un utilisateur peut personnaliser cet ordre
// (voir NavOrderModal) ; ce tableau reste la référence pour les entrées non
// encore réordonnées et pour filtrer par rôle.
export const NAV_ENTRIES: NavEntry[] = [
  { href: "/taches", label: "Tâches", icon: Table2, adminOnly: false, countKey: "tasksLate", group: "Travail" },
  { href: "/mes-taches", label: "Mes tâches", icon: CheckSquare, adminOnly: false, countKey: "mesTaches", group: "Travail" },
  { href: "/planning", label: "Planning", icon: Columns3, adminOnly: false, group: "Travail" },
  { href: "/projets", label: "Projets", icon: ListChecks, adminOnly: false, countKey: "projectsOverBudget", group: "Projets" },
  { href: "/clients", label: "Clients", icon: Building2, adminOnly: false, group: "Projets" },
  { href: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard, adminOnly: true, group: "Suivi" },
  { href: "/temps", label: "Temps", icon: Clock, adminOnly: false, group: "Suivi" },
  { href: "/charge", label: "Charge", icon: Activity, adminOnly: true, studioLeadOk: true, group: "Suivi" },
  { href: "/equipe", label: "Équipe", icon: Users, adminOnly: false, group: "Équipe" },
  { href: "/demandes", label: "Demandes", icon: ClipboardList, adminOnly: true, countKey: "demandes", group: "Équipe" },
  { href: "/reglages", label: "Réglages", icon: Settings, adminOnly: true, group: "Équipe" },
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
