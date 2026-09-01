"use client";

import type { LucideIcon } from "lucide-react";

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Infobulle facultative, quand le libellé seul est trop court pour se suffire. */
  title?: string;
}

/**
 * Bascule entre plusieurs vues d'un même écran — Calendrier/Liste/Par projet,
 * Kanban/Semaine/Gantt, Cartes/Tableau, Mon temps/Équipe…
 *
 * Ces bascules étaient jusqu'ici des boutons indépendants (un bouton plein
 * pour l'option active, des boutons contournés pour les autres) : chaque
 * option prenait le poids visuel d'une action à part entière, à côté des
 * vraies actions de la page, et rien ne disait qu'elles allaient ensemble.
 * Ici une seule piste en pilule contient toutes les options et seule la vue
 * courante est remplie — le groupe se lit comme un contrôle unique, et le
 * bouton plein reste réservé aux actions (Nouvelle tâche, Enregistrer…).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  const segment = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const iconSize = size === "sm" ? 13 : 14;
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border-[1.5px] border-line bg-wash p-0.5"
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            title={o.title}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-100 ${segment} ${
              active ? "bg-heading text-paper" : "text-ink-muted hover:text-heading"
            }`}
          >
            {o.icon && <o.icon size={iconSize} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
