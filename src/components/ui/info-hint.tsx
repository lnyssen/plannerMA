"use client";

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Explication repliée derrière un « i ».
 *
 * Certaines vues (Charge) posaient six lignes de texte explicatif sous leur
 * tableau : de la documentation déposée dans la page, lue une fois puis
 * ignorée, mais qui pèse à chaque visite. Le même texte reste disponible ici,
 * à la demande et juste à côté de ce qu'il explique.
 */
export function InfoHint({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition-colors duration-100 hover:bg-wash hover:text-heading"
      >
        <Info size={15} />
      </button>
      {open && (
        <div
          role="note"
          className="absolute top-7 left-0 z-30 w-[min(28rem,calc(100vw-3rem))] rounded-lg border-[1.5px] border-heading bg-paper p-3 text-xs leading-relaxed text-ink shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
