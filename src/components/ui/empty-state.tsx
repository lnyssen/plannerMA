import type { LucideIcon } from "lucide-react";
import { primaryButtonClass } from "./buttons";

/** État vide commun — même registre que l'état "aucun résultat" déjà en place sur Tâches, généralisé partout où une liste peut être vide. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-line p-16 text-center">
      {Icon && <Icon size={22} className="mx-auto mb-3 text-heading" aria-hidden="true" />}
      <p className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-heading">{title}</p>
      {description && <p className="text-sm text-ink">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
