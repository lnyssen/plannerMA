"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

const WIDTH_CLASS = {
  md: "sm:w-[32rem]",
  lg: "sm:w-[40rem]",
} as const;

/**
 * Panneau qui glisse depuis la droite, pour les formulaires de création.
 *
 * Ces formulaires étaient des modales centrées, ce qui se tenait tant que la
 * création partait du seul bouton global. Depuis que le geste porte le
 * contexte — tirer une plage de dates dans Semaine ou Gantt, « + » dans une
 * colonne du Kanban — une boîte centrée recouvre précisément ce qui vient de
 * fournir la personne, le projet ou les dates : on ne voit plus la ligne ni
 * la colonne d'où l'on part au moment de vérifier le formulaire. Sur le
 * côté, le contexte reste lisible à côté du champ.
 *
 * ModalShell reste pour ce qui doit interrompre et occuper le centre du
 * regard : une confirmation de suppression, notamment.
 */
export function SidePanel({
  title,
  onClose,
  size = "md",
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  size?: keyof typeof WIDTH_CLASS;
  /** Barre d'actions fixée en bas, hors de la zone qui défile. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-rail/45" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full flex-col border-l border-heading bg-paper motion-safe:animate-[panel-in_180ms_ease-out] ${WIDTH_CLASS[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mt-1.5 -mr-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-100 hover:bg-wash hover:text-ink active:bg-tint/40"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
