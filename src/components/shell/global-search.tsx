"use client";

import {
  Building2,
  ClipboardList,
  ClipboardPlus,
  Clock,
  FolderPlus,
  ListChecks,
  ListPlus,
  MessageSquare,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { globalSearch, type SearchResults } from "@/lib/actions/search";
import { getRecentItems, type RecentItem } from "@/lib/recent-items";
import { useCreateModals } from "./create-modals-context";
import type { NavEntry } from "./nav-entries";
import { iconButtonOnRailClass } from "@/components/ui/buttons";
import { popoverSurfaceClass } from "@/components/ui/popover";
import { fieldInputClass } from "@/components/modals/modal-shell";

const PANEL_WIDTH = 360;
const VIEWPORT_MARGIN = 12;
const DEBOUNCE_MS = 200;

const EMPTY: SearchResults = { tasks: [], projects: [], clients: [], comments: [] };

/**
 * Même positionnement en `fixed` que NotificationBell — la barre latérale a
 * `overflow-y-auto`, qui rogne aussi l'axe horizontal (voir ce composant).
 *
 * Deux présentations pour un même panneau : `field` est un vrai champ de
 * recherche pleine largeur dans la barre latérale (la recherche est une des
 * portes d'entrée principales de l'appli, une icône de 20 px la cachait), et
 * `icon` reste l'icône seule là où la place manque — en-tête mobile et rail
 * replié aux icônes.
 */
export function GlobalSearch({
  variant = "icon",
  navEntries = [],
}: {
  variant?: "icon" | "field";
  navEntries?: NavEntry[];
}) {
  const router = useRouter();
  const ouvrirModale = useCreateModals();
  const declencheurRef = useRef<HTMLElement>(null);
  const champRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = declencheurRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(240, Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2));
      // Sous un vrai champ, le panneau s'aligne sur son bord gauche : il
      // prolonge le champ au lieu de flotter à côté.
      const souhaite = variant === "field" ? rect.left : rect.right - width;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(souhaite, window.innerWidth - width - VIEWPORT_MARGIN));
      setCoords({ top: rect.bottom + 8, left, width });
    }
    place();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("resize", place);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const id = setTimeout(async () => {
      const r = await globalSearch(trimmedQuery);
      setResults(r);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [trimmedQuery]);

  function ouvrir() {
    // Relus à chaque ouverture, pas une fois au montage : ils changent au fil
    // de la navigation (voir src/lib/recent-items.ts).
    setRecents(getRecentItems());
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    champRef.current?.blur();
  }

  /**
   * ⌘K / Ctrl K. Deux exemplaires du composant sont montés en permanence — le
   * champ de la barre latérale et l'icône de l'en-tête mobile — mais un seul
   * est visible à la fois : c'est lui qui répond, sinon le raccourci
   * déclencherait les deux.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      if (!declencheurRef.current?.getClientRects().length) return;
      e.preventDefault();
      if (open) {
        close();
        return;
      }
      ouvrir();
      if (variant === "field") {
        champRef.current?.focus();
        champRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const q = query.trim().toLowerCase();
  const actions = [
    { key: "new-task", label: "Nouvelle tâche", icon: ListPlus, onSelect: () => ouvrirModale("task") },
    { key: "new-project", label: "Nouveau projet", icon: FolderPlus, onSelect: () => ouvrirModale("project") },
    { key: "new-request", label: "Nouvelle demande", icon: ClipboardPlus, onSelect: () => ouvrirModale("request") },
    ...navEntries.map((e) => ({ key: `go-${e.href}`, label: e.label, icon: e.icon, onSelect: () => router.push(e.href) })),
  ];
  // Champ vide, on propose les trois créations ; dès qu'on tape, tout est
  // filtré — l'ancienne palette faisait déjà exactement ça.
  const actionsAffichees = q ? actions.filter((a) => a.label.toLowerCase().includes(q)) : actions.slice(0, 3);

  // Sous deux caractères, on n'a rien interrogé : afficher les résultats
  // d'une recherche précédente serait trompeur, mieux vaut les masquer sans
  // les jeter (évite un setState synchrone dans l'effet ci-dessus).
  const displayResults = trimmedQuery.length < 2 ? EMPTY : results;
  const hasResults =
    displayResults.tasks.length > 0 ||
    displayResults.projects.length > 0 ||
    displayResults.clients.length > 0 ||
    displayResults.comments.length > 0;

  const TITLE = "Recherche (ou ⌘K / Ctrl K depuis n'importe où)";

  return (
    <div className="relative">
      {variant === "field" ? (
        /* Un vrai champ, pas un bouton qui en a l'air : le précédent ouvrait
           un panneau contenant un second champ identique, huit pixels plus
           bas, et celui du haut ne se remplissait jamais. On tape ici, les
           résultats se déroulent en dessous.

           La pilule est le champ lui-même, l'icône et le raccourci n'étant
           que posés dessus : avec un conteneur enveloppant, l'anneau de focus
           — porté par `:focus-visible` hors couche, voir globals.css —
           dessinait un rectangle à l'intérieur d'une forme arrondie. */
        <div className="relative w-full">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/70"
            aria-hidden="true"
          />
          <input
            ref={(el) => {
              champRef.current = el;
              (declencheurRef as React.MutableRefObject<HTMLElement | null>).current = el;
            }}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) ouvrir();
            }}
            onFocus={ouvrir}
            title={TITLE}
            placeholder="Rechercher…"
            aria-label="Rechercher"
            className="h-9 w-full rounded-full border border-white/25 bg-white/10 pr-14 pl-9 text-sm font-medium text-white transition-colors duration-100 placeholder:text-white/70 hover:bg-white/20"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-full border border-white/25 px-1.5 py-px text-2xs font-semibold text-white/60">
            ⌘K
          </span>
        </div>
      ) : (
        <button
          ref={(el) => {
            (declencheurRef as React.MutableRefObject<HTMLElement | null>).current = el;
          }}
          type="button"
          onClick={() => (open ? close() : ouvrir())}
          aria-label="Recherche"
          title={TITLE}
          className={`flex h-7 w-7 items-center justify-center ${iconButtonOnRailClass}`}
        >
          <Search size={20} />
        </button>
      )}

      {/* Même raison que pour la cloche : la barre latérale est `sticky`, donc
          un contexte d'empilement dont un panneau interne ne peut pas sortir. */}
      {open && coords && createPortal(
        <>
          <button type="button" aria-label="Fermer" className="fixed inset-0 z-30" onClick={close} />
          <div
            style={{ top: coords.top, left: coords.left, width: coords.width }}
            className={`fixed z-40 flex max-h-[70vh] flex-col overflow-y-auto ${popoverSurfaceClass}`}
          >
            {/* En présentation « icône » il n'y a pas de champ à l'écran :
                le panneau en fournit un. Sous un vrai champ, le reprendre
                ferait deux fois la même chose. */}
            {variant === "icon" && (
              <div className="border-b border-line p-2">
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className={fieldInputClass}
                />
              </div>
            )}

            {actionsAffichees.length > 0 && (
              <div>
                <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Actions</p>
                {actionsAffichees.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => {
                      a.onSelect();
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

            {!q && recents.length > 0 && (
              <div>
                <p className="px-3 pt-2.5 pb-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">Récents</p>
                {recents.map((r) => (
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

            {trimmedQuery.length >= 2 && !hasResults && actionsAffichees.length === 0 && (
              <p className="px-3 py-4 text-sm text-ink-muted">Aucun résultat pour « {query.trim()} ».</p>
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
                      {p.archived && <span className="text-ink-muted"> · archivé</span>}
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
        </>,
        document.body,
      )}
    </div>
  );
}
