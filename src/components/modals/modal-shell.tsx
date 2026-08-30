"use client";

import { X } from "lucide-react";

const SIZE_CLASS = {
  md: "max-w-xl",
  lg: "max-w-2xl",
} as const;

export function ModalShell({
  title,
  onClose,
  size = "md",
  children,
}: {
  title: string;
  onClose: () => void;
  /** "lg" pour les formulaires denses (fiche de tâche) — voir SIZE_CLASS. */
  size?: keyof typeof SIZE_CLASS;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-rail/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90vh] w-full flex-col border border-heading bg-paper ${SIZE_CLASS[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-ink-muted hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        {/* Le contenu défile si trop long pour l'écran plutôt que de déborder la fenêtre (fenêtre tâche notamment). */}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink">
      {children}
    </label>
  );
}

export const fieldInputClass =
  "w-full border-[1.5px] border-heading bg-paper px-2.5 py-2 text-sm text-ink outline-none";
