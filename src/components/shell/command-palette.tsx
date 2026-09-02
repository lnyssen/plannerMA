"use client";

import { Building2, ClipboardList, ClipboardPlus, Clock, FolderPlus, ListChecks, ListPlus, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { globalSearch, type SearchResults } from "@/lib/actions/search";
import { getRecentItems, type RecentItem } from "@/lib/recent-items";
import { useCreateModals } from "./create-modals-context";
import type { NavEntry } from "./nav-entries";

const EMPTY: SearchResults = { tasks: [], projects: [], clients: [], comments: [] };
const DEBOUNCE_MS = 200;

interface Action {
  key: string;
  label: string;
  icon: typeof ListPlus;
  onSelect: () => void;
}

/**
 * Palette de commandes (Cmd/Ctrl+K) — combine la recherche globale déjà
 * disponible via l'icône loupe (GlobalSearch, laissée inchangée) et les
 * actions rapides (créer, aller à une page) en un seul raccourci clavier,
 * accessible depuis n'importe où dans l'appli plutôt que de devoir d'abord
 * cliquer l'icône puis re-cliquer un résultat.
 */
export function CommandPalette({ navEntries }: { navEntries: NavEntry[] }) {
  const router = useRouter();
  const openCreateModal = useCreateModals();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (o) {
            setQuery("");
            setResults(EMPTY);
            return false;
          }
          // Relu à chaque ouverture (pas une seule fois au montage) : peut
          // avoir changé depuis la dernière fois — voir src/lib/recent-items.ts.
          setRecentItems(getRecentItems());
          return true;
        });
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const trimmedQuery = query.trim();
  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const id = setTimeout(async () => {
      const r = await globalSearch(trimmedQuery);
      setResults(r);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [trimmedQuery]);

  function go(href: string) {
    router.push(href);
    close();
  }

  const actions: Action[] = [
    { key: "new-task", label: "Nouvelle tâche", icon: ListPlus, onSelect: () => openCreateModal("task") },
    { key: "new-project", label: "Nouveau projet", icon: FolderPlus, onSelect: () => openCreateModal("project") },
    { key: "new-request", label: "Nouvelle demande", icon: ClipboardPlus, onSelect: () => openCreateModal("request") },
    ...navEntries.map((e) => ({ key: `go-${e.href}`, label: e.label, icon: e.icon, onSelect: () => go(e.href) })),
  ];

  const q = trimmedQuery.toLowerCase();
  const displayResults = trimmedQuery.length < 2 ? EMPTY : results;
  const matchedActions = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions.slice(0, 3);
  const hasSearchResults =
    displayResults.tasks.length > 0 ||
    displayResults.projects.length > 0 ||
    displayResults.clients.length > 0 ||
    displayResults.comments.length > 0;
  const nothingFound = trimmedQuery.length >= 2 && matchedActions.length === 0 && !hasSearchResults;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" onClick={close}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-rail/45" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-heading bg-paper shadow-none"
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Search size={16} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher ou lancer une action…"
            className="w-full text-sm text-ink"
          />
          <kbd className="flex-shrink-0 rounded border border-line px-1.5 py-0.5 text-2xs text-ink-muted">Échap</kbd>
        </div>

        <div className="overflow-y-auto">
          {nothingFound && <p className="px-3 py-4 text-sm text-ink-muted">Aucun résultat pour « {trimmedQuery} ».</p>}

          {matchedActions.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Actions</p>
              {matchedActions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    a.onSelect();
                    if (a.key.startsWith("go-")) return; // go() ferme déjà via router.push
                    close();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-tint"
                >
                  <a.icon size={14} className="flex-shrink-0 text-heading" aria-hidden="true" />
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {!q && recentItems.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Récents</p>
              {recentItems.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={close}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-tint"
                >
                  <Clock size={14} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="truncate">{r.label}</span>
                </Link>
              ))}
            </div>
          )}

          {displayResults.tasks.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Tâches</p>
              {displayResults.tasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/taches/${t.id}`}
                  onClick={close}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-tint"
                >
                  <ListChecks size={14} className="flex-shrink-0 text-heading" aria-hidden="true" />
                  <span className="truncate">
                    {t.title}
                    {t.projectName && <span className="text-ink-muted"> — {t.projectName}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}

          {displayResults.projects.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Projets</p>
              {displayResults.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projets/${p.id}`}
                  onClick={close}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-tint"
                >
                  <ClipboardList size={14} className="flex-shrink-0 text-heading" aria-hidden="true" />
                  <span className="truncate">
                    {p.name}
                    {p.code && <span className="text-ink-muted"> ({p.code})</span>} <span className="text-ink-muted">— {p.clientName}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {displayResults.clients.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Clients</p>
              {displayResults.clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients?open=${c.id}`}
                  onClick={close}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-tint"
                >
                  <Building2 size={14} className="flex-shrink-0 text-heading" aria-hidden="true" />
                  <span className="truncate">{c.name}</span>
                </Link>
              ))}
            </div>
          )}

          {displayResults.comments.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Commentaires</p>
              {displayResults.comments.map((c) => (
                <Link
                  key={c.id}
                  href={`/taches/${c.taskId}`}
                  onClick={close}
                  className="flex items-start gap-2 px-3 py-2 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-tint"
                >
                  <MessageSquare size={14} className="mt-0.5 flex-shrink-0 text-heading" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-ink-muted">{c.taskTitle}</span>
                    <span className="block truncate">{c.snippet}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
