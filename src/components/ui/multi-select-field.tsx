"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface MultiSelectOption {
  id: string;
  label: string;
}

/**
 * Filtre à choix multiples — remplace un `<select>` simple partout où
 * l'utilisateur veut pouvoir cocher plusieurs valeurs à la fois (ex. deux
 * studios) plutôt qu'une seule. Tableau vide = pas de filtre, même
 * convention que la chaîne vide des `<select>` qu'il remplace.
 */
export function MultiSelectField({
  label,
  options,
  selected,
  onChange,
  className = "",
}: {
  /** Libellé affiché quand rien n'est coché (ex. "Tous les studios"). */
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? label)
        : `${selected.length} sélectionnés`;

  return (
    <div ref={ref} className={`relative min-w-0 max-w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
        className="flex h-10 w-full min-w-0 items-center gap-1.5 rounded-md border-[1.5px] border-heading px-2.5 text-sm"
        style={{ color: selected.length > 0 ? "var(--color-heading)" : "var(--color-ink)", fontWeight: selected.length > 0 ? 600 : 400 }}
      >
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        <ChevronDown size={14} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-40 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-heading bg-paper py-1 shadow-none">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">Aucune option.</p>
          ) : (
            options.map((o) => {
              const checked = selected.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  aria-pressed={checked}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink transition-colors duration-100 hover:bg-wash"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
                    style={{
                      border: `1.5px solid ${checked ? "var(--color-heading)" : "var(--color-line)"}`,
                      background: checked ? "var(--color-heading)" : "transparent",
                    }}
                  >
                    {checked && <Check size={11} color="var(--color-paper)" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-line px-3 py-1.5 text-left text-xs font-semibold text-ink-muted transition-colors duration-100 hover:bg-wash"
            >
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
