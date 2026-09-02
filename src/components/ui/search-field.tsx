"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Champ de recherche qui reste une simple icône loupe tant qu'il n'est pas
 * utilisé, et s'ouvre en champ texte au clic — pour qu'un champ de recherche
 * se reconnaisse toujours à la même icône, plutôt qu'un texte de substitution
 * qui varie d'un endroit à l'autre. Reste ouvert tant qu'une recherche est en
 * cours (fermer effacerait un filtre actif sans prévenir).
 */
export function SearchField({
  value,
  onChange,
  placeholder = "Rechercher…",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open && !value) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={placeholder}
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-heading text-heading transition-colors duration-100 hover:bg-heading/10 active:bg-heading/15 ${className}`}
      >
        <Search size={16} />
      </button>
    );
  }

  return (
    <div className={`relative min-w-[160px] flex-1 ${className}`}>
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            setOpen(false);
          }
        }}
        className="h-10 w-full rounded-md border-[1.5px] border-heading bg-paper py-2 pr-8 pl-9 text-sm text-ink"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-muted transition-opacity duration-100 hover:opacity-70"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
