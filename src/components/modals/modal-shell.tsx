"use client";

import { X, type LucideIcon } from "lucide-react";

const SIZE_CLASS = {
  md: "max-w-xl",
  lg: "max-w-2xl",
} as const;

export function ModalShell({
  title,
  onClose,
  size = "md",
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  /** "lg" pour les formulaires denses (fiche de tâche) — voir SIZE_CLASS. */
  size?: keyof typeof SIZE_CLASS;
  /** Barre d'actions fixée en bas, hors de la zone qui défile — pour qu'Enregistrer reste toujours atteignable sur un contenu long (fiche de tâche notamment). Sans ce prop, les boutons passés en `children` défilent avec le reste, comme avant. */
  footer?: React.ReactNode;
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
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg border border-heading bg-paper ${SIZE_CLASS[size]}`}
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
        {/* Le contenu défile si trop long pour l'écran plutôt que de déborder la fenêtre (fenêtre tâche notamment). */}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
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

/**
 * Regroupe un bloc de champs sous un intitulé net, avec un peu d'air et un
 * filet — pour que les fiches denses (projet, tâche) se scannent en blocs
 * plutôt qu'en une seule colonne continue de labels de même poids.
 */
export function FieldSection({
  title,
  icon: Icon,
  action,
  children,
  first = false,
}: {
  title: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Le tout premier bloc n'a pas besoin du filet du dessus. */
  first?: boolean;
}) {
  return (
    <section className={first ? "mb-5" : "mt-6 mb-5 border-t border-line pt-5"}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-2xs font-bold tracking-wide text-ink-muted uppercase">
          {Icon && <Icon size={13} className="flex-shrink-0" aria-hidden="true" />}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export const fieldInputClass =
  "w-full rounded-md border-[1.5px] border-heading bg-paper px-2.5 py-2 text-sm text-ink outline-none";
