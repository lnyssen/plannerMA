"use client";

import { Building2, ClipboardList, ListChecks, MessageSquare, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { globalSearch, type SearchResults } from "@/lib/actions/search";
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
export function GlobalSearch({ variant = "icon" }: { variant?: "icon" | "field" }) {
  const declencheurRef = useRef<HTMLElement>(null);
  const champRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
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

  function close() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    champRef.current?.blur();
  }

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
           résultats se déroulent en dessous. */
        <div
          // L'anneau de focus est porté par la pilule, pas par le champ : le
          // contour par défaut dessinait un rectangle à l'intérieur d'une
          // forme arrondie.
          className="flex h-9 w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 transition-colors duration-100 focus-within:border-white/70 focus-within:bg-white/20 focus-within:ring-2 focus-within:ring-white/50"
        >
          <Search size={15} className="flex-shrink-0 text-white/70" aria-hidden="true" />
          <input
            ref={(el) => {
              champRef.current = el;
              (declencheurRef as React.MutableRefObject<HTMLElement | null>).current = el;
            }}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            title={TITLE}
            placeholder="Rechercher…"
            aria-label="Rechercher"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-white placeholder:text-white/70 focus:outline-none focus-visible:outline-none"
          />
          <span className="flex-shrink-0 rounded-full border border-white/25 px-1.5 py-px text-2xs font-semibold text-white/60">
            ⌘K
          </span>
        </div>
      ) : (
        <button
          ref={(el) => {
            (declencheurRef as React.MutableRefObject<HTMLElement | null>).current = el;
          }}
          type="button"
          onClick={() => setOpen((o) => !o)}
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

            {trimmedQuery.length < 2 && (
              <p className="px-3 py-4 text-sm text-ink-muted">Tapez au moins deux caractères — tâches, projets, clients, commentaires.</p>
            )}

            {trimmedQuery.length >= 2 && !hasResults && (
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
