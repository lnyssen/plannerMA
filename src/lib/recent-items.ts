"use client";

// Derniers éléments consultés (tâches/projets) — pur confort local, jamais
// lu par le serveur ni par un autre appareil (voir la palette de commandes,
// seul lecteur). localStorage plutôt qu'un état applicatif : ça doit
// survivre à un rechargement de page sans justifier une table en base pour
// un simple raccourci.

const STORAGE_KEY = "planning-studios:recent-items";
const MAX_ITEMS = 8;

export interface RecentItem {
  type: "task" | "project";
  id: string;
  label: string;
  href: string;
}

export function recordRecentItem(item: RecentItem): void {
  try {
    const existing = getRecentItems().filter((i) => i.href !== item.href);
    const next = [item, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage indisponible (navigation privée, quota…) — tant pis, pas de récents.
  }
}

export function getRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is RecentItem =>
        typeof i === "object" && i !== null && "href" in i && "label" in i && "type" in i && "id" in i,
    );
  } catch {
    return [];
  }
}
