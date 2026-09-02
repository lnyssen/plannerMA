"use client";

import { ArrowDown, ArrowUp, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: string;
  /** Colonne qu'on ne peut pas masquer — celle qui identifie la ligne. */
  required?: boolean;
  /** Valeur de tri ; absente = colonne non triable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  /** Classes de la cellule (alignement, largeur…). */
  cellClassName?: string;
  headClassName?: string;
}

interface Preferences {
  ordre: string[];
  masquees: string[];
}

function lire(cle: string): Preferences | null {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return null;
    const p: unknown = JSON.parse(brut);
    if (typeof p !== "object" || p === null) return null;
    const { ordre, masquees } = p as Preferences;
    if (!Array.isArray(ordre) || !Array.isArray(masquees)) return null;
    return { ordre, masquees };
  } catch {
    return null;
  }
}

/**
 * Tableau de données commun à tous les écrans.
 *
 * Chaque écran avait le sien : six tableaux, six styles d'en-tête, trois
 * conventions de bordure, et le tri ou le clic sur la ligne présents ici mais
 * pas là. Rien ne se ressemblait d'un écran à l'autre alors que tous montrent
 * la même chose — une liste d'objets qu'on trie et qu'on ouvre.
 *
 * Le choix des colonnes vit ici plutôt que dans chaque écran : c'est ce qui
 * permet de l'avoir partout sans ajouter un réglage à maintenir six fois. Les
 * préférences sont propres à chaque personne et à chaque tableau (stockage
 * local, une clé par tableau) — ce n'est pas une donnée d'équipe.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  storageKey,
  empty,
  leadingCell,
  leadingHead,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Clé de stockage des préférences de colonnes — une par tableau. */
  storageKey: string;
  empty?: ReactNode;
  /** Cellule ajoutée en tête de ligne (case à cocher…), hors gestion de colonnes. */
  leadingCell?: (row: T) => ReactNode;
  leadingHead?: ReactNode;
}) {
  const [prefs, setPrefs] = useState<Preferences>({ ordre: [], masquees: [] });
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const [tri, setTri] = useState<{ cle: string; sens: "asc" | "desc" } | null>(null);
  const panneauRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = lire(storageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage n'existe pas au rendu serveur
    if (p) setPrefs(p);
  }, [storageKey]);

  useEffect(() => {
    if (!panneauOuvert) return;
    function surClic(e: PointerEvent) {
      if (panneauRef.current && !panneauRef.current.contains(e.target as Node)) setPanneauOuvert(false);
    }
    document.addEventListener("pointerdown", surClic);
    return () => document.removeEventListener("pointerdown", surClic);
  }, [panneauOuvert]);

  function enregistrer(next: Preferences) {
    setPrefs(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Préférence perdue à la prochaine session, sans conséquence fonctionnelle.
    }
  }

  // Ordre effectif : celui choisi, puis les colonnes apparues depuis (nouvelle
  // version de l'appli) à leur place d'origine plutôt qu'ignorées.
  const ordonnees = [
    ...prefs.ordre.map((k) => columns.find((c) => c.key === k)).filter((c): c is Column<T> => Boolean(c)),
    ...columns.filter((c) => !prefs.ordre.includes(c.key)),
  ];
  const visibles = ordonnees.filter((c) => c.required || !prefs.masquees.includes(c.key));

  function basculer(cle: string) {
    const masquees = prefs.masquees.includes(cle)
      ? prefs.masquees.filter((k) => k !== cle)
      : [...prefs.masquees, cle];
    enregistrer({ ordre: ordonnees.map((c) => c.key), masquees });
  }

  function deplacer(cle: string, sens: -1 | 1) {
    const cles = ordonnees.map((c) => c.key);
    const i = cles.indexOf(cle);
    const j = i + sens;
    if (j < 0 || j >= cles.length) return;
    [cles[i], cles[j]] = [cles[j], cles[i]];
    enregistrer({ ordre: cles, masquees: prefs.masquees });
  }

  const triees = tri
    ? [...rows].sort((a, b) => {
        const col = columns.find((c) => c.key === tri.cle);
        if (!col?.sortValue) return 0;
        const va = col.sortValue(a);
        const vb = col.sortValue(b);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr");
        return tri.sens === "asc" ? cmp : -cmp;
      })
    : rows;

  const personnalise = prefs.masquees.length > 0 || prefs.ordre.length > 0;

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div ref={panneauRef} className="relative">
          <button
            type="button"
            onClick={() => setPanneauOuvert((v) => !v)}
            aria-expanded={panneauOuvert}
            title="Choisir et réordonner les colonnes"
            className="flex h-8 items-center gap-1.5 rounded-full border-[1.5px] border-line px-2.5 text-xs font-semibold text-ink-muted transition-colors duration-100 hover:border-heading hover:text-heading"
          >
            <Columns3 size={13} aria-hidden="true" />
            Colonnes
            {personnalise && <span className="h-1.5 w-1.5 rounded-full bg-heading" aria-label="personnalisées" />}
          </button>

          {panneauOuvert && (
            <div className="absolute top-full right-0 z-30 mt-1 w-64 rounded-lg border-[1.5px] border-heading bg-paper p-2 shadow-lg">
              <p className="mb-1.5 px-1 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                Colonnes affichées
              </p>
              {ordonnees.map((c, i) => {
                const visible = c.required || !prefs.masquees.includes(c.key);
                return (
                  <div key={c.key} className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-wash">
                    <input
                      type="checkbox"
                      id={`${storageKey}-${c.key}`}
                      checked={visible}
                      disabled={c.required}
                      onChange={() => basculer(c.key)}
                      className="h-3.5 w-3.5 accent-heading disabled:opacity-40"
                    />
                    <label
                      htmlFor={`${storageKey}-${c.key}`}
                      className={`min-w-0 flex-1 truncate text-sm ${c.required ? "text-ink-muted" : "text-ink"}`}
                      title={c.required ? "Colonne toujours affichée" : undefined}
                    >
                      {c.label}
                    </label>
                    <button
                      type="button"
                      onClick={() => deplacer(c.key, -1)}
                      disabled={i === 0}
                      aria-label={`Monter ${c.label}`}
                      className="p-0.5 text-ink-muted disabled:opacity-25 hover:text-heading"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(c.key, 1)}
                      disabled={i === ordonnees.length - 1}
                      aria-label={`Descendre ${c.label}`}
                      className="p-0.5 text-ink-muted disabled:opacity-25 hover:text-heading"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                );
              })}
              {personnalise && (
                <button
                  type="button"
                  onClick={() => enregistrer({ ordre: [], masquees: [] })}
                  className="mt-1.5 flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-xs font-semibold text-heading hover:bg-wash"
                >
                  <RotateCcw size={12} /> Rétablir l’ordre d’origine
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {triees.length === 0 && empty ? (
        empty
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {leadingHead !== undefined && (
                  <th className="w-8 border-b-2 border-heading px-3 py-2.5">{leadingHead}</th>
                )}
                {visibles.map((c) => {
                  const triable = Boolean(c.sortValue);
                  const actif = tri?.cle === c.key;
                  return (
                    <th
                      key={c.key}
                      onClick={
                        triable
                          ? () =>
                              setTri((t) =>
                                t?.cle === c.key ? { cle: c.key, sens: t.sens === "asc" ? "desc" : "asc" } : { cle: c.key, sens: "asc" },
                              )
                          : undefined
                      }
                      aria-sort={actif ? (tri!.sens === "asc" ? "ascending" : "descending") : undefined}
                      className={`border-b-2 border-heading px-3 py-2.5 text-left font-[family-name:var(--font-display)] text-sm font-medium tracking-[-0.1px] whitespace-nowrap text-heading ${
                        triable ? "cursor-pointer transition-colors duration-100 hover:bg-wash active:bg-tint" : ""
                      } ${c.headClassName ?? ""}`}
                    >
                      {c.label} {actif ? (tri!.sens === "asc" ? "▲" : "▼") : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {triees.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  title={onRowClick ? "Ouvrir la fiche" : undefined}
                  className={onRowClick ? "cursor-pointer transition-colors duration-100 hover:bg-wash active:bg-tint" : ""}
                >
                  {leadingCell && (
                    <td className="border-b border-line px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {leadingCell(row)}
                    </td>
                  )}
                  {visibles.map((c) => (
                    <td key={c.key} className={`border-b border-line px-3 py-2.5 text-sm text-ink ${c.cellClassName ?? ""}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
