import {
  Activity,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock,
  Columns3,
  ListChecks,
  Settings,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Clé vers un compteur calculé côté serveur (voir NavCounts) — absent = pas de puce. */
export type NavCountKey = "mesTaches" | "demandes" | "tasksLate" | "projectsOverBudget";

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
  /** Un responsable de studio y accède aussi (vue limitée à son studio), même si `adminOnly` est vrai. */
  studioLeadOk?: boolean;
  countKey?: NavCountKey;
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
  { href: "/projets", label: "Projets", icon: ListChecks, adminOnly: false, countKey: "projectsOverBudget" },
  { href: "/taches", label: "Tâches", icon: Table2, adminOnly: false, countKey: "tasksLate" },
  { href: "/mes-taches", label: "Mes tâches", icon: CheckSquare, adminOnly: false, countKey: "mesTaches" },
  { href: "/planning", label: "Planning", icon: Columns3, adminOnly: false },
  { href: "/temps", label: "Temps", icon: Clock, adminOnly: false },
  { href: "/clients", label: "Clients", icon: Building2, adminOnly: false },
  { href: "/equipe", label: "Équipe", icon: Users, adminOnly: false },
  { href: "/charge", label: "Charge", icon: Activity, adminOnly: true, studioLeadOk: true },
  { href: "/demandes", label: "Demandes", icon: ClipboardList, adminOnly: true, countKey: "demandes" },
  { href: "/reglages", label: "Réglages", icon: Settings, adminOnly: true },
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
