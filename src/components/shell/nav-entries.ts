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
  Users,
  type LucideIcon,
} from "lucide-react";

/** Clé vers un compteur calculé côté serveur (voir NavCounts) — absent = pas de puce. */
export type NavCountKey = "mesTaches" | "demandes" | "projectsActive";

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
  /** Sous-ensemble de mesTaches dont l'échéance est dépassée — puce d'alerte. */
  mesTachesLate: number;
  demandes: number;
  projectsActive: number;
  /** Sous-ensemble de projectsActive (budget de temps dépassé) — même principe que tasksLate. */
  projectsOverBudget: number;
}

/**
 * Les deux puces que peut porter une entrée de menu, lues séparément.
 *
 * Avant, un seul nombre servait aux deux usages : la puce affichait le total
 * d'éléments en cours mais virait au rouge avec un triangle collé à ce total
 * dès qu'un seul était en retard — ce qui se lit « 4 tâches en alerte » alors
 * que ça voulait dire « 4 en cours, dont quelques-unes en retard ». Le nombre
 * combien et le nombre en problème sont désormais deux puces distinctes,
 * côte à côte : `total` reste neutre et informatif, `alert` porte son propre
 * nombre en rouge et n'apparaît que s'il y a effectivement un problème.
 */
export interface NavBadges {
  total: number;
  /** Phrase d'infobulle du total — une puce nue ne se comprend pas d'elle-même. */
  totalLabel: string;
  /** Sous-ensemble à problème du total ; 0 = pas de puce d'alerte. */
  alert: number;
  /** Phrase d'infobulle de l'alerte, formulée pour suivre `totalLabel` (« …, dont X en retard »). */
  alertLabel: string;
}

const s = (n: number) => (n > 1 ? "s" : "");

export const NAV_COUNT_META: Record<NavCountKey, (counts: NavCounts) => NavBadges> = {
  projectsActive: (c) => ({
    total: c.projectsActive,
    totalLabel: `${c.projectsActive} projet${s(c.projectsActive)} en cours`,
    alert: c.projectsOverBudget,
    alertLabel: `${c.projectsOverBudget} au-delà de son budget de temps`,
  }),
  // La puce reflète ce que l'écran montre par défaut : votre travail. Un
  // total d'équipe à côté d'une vue personnelle ne se comprendrait pas.
  mesTaches: (c) => ({
    total: c.mesTaches,
    totalLabel: `${c.mesTaches} tâche${s(c.mesTaches)} qui vous ${c.mesTaches > 1 ? "sont" : "est"} attribuée${s(c.mesTaches)}, pas encore terminée${s(c.mesTaches)}`,
    alert: c.mesTachesLate,
    alertLabel: `${c.mesTachesLate} dont l’échéance est dépassée`,
  }),
  demandes: (c) => ({
    total: c.demandes,
    totalLabel: `${c.demandes} demande${s(c.demandes)} en attente de traitement`,
    alert: 0,
    alertLabel: "",
  }),
};

// Ordre par défaut, conforme à la maquette Claude Design (5 écrans conçus :
// Semaine, Projets, Tâches, Équipe, Réglages) + les écrans ajoutés depuis
// avec le même système visuel. Un utilisateur peut personnaliser cet ordre
// (voir NavOrderModal) ; ce tableau reste la référence pour les entrées non
// encore réordonnées et pour filtrer par rôle.
export const NAV_ENTRIES: NavEntry[] = [
  { href: "/aujourdhui", label: "Aujourd’hui", icon: Home, adminOnly: false, group: "Travail" },
  // Une seule entrée : "Mes tâches" et "Tâches" étaient le même tableau à un
  // filtre près. La bascule vit désormais dans l'écran, ouvert par défaut sur
  // son propre travail. La puce compte ce qui vous est attribué — le nombre
  // qu'on regarde le matin — et l'alerte, ce qui déborde dans toute l'équipe.
  { href: "/taches", label: "Tâches", icon: CheckSquare, adminOnly: false, countKey: "mesTaches", group: "Travail" },
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
