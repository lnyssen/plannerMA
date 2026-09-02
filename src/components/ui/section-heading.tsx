/**
 * Intitulé d'une section de page.
 *
 * L'appli mélangeait deux systèmes pour la même chose : de vrais titres
 * (Temps) et des micro-étiquettes grises en capitales (« TÂCHES DU JOUR »,
 * « SOUS-TÂCHES », « PROCHAINES ÉCHÉANCES »). Les capitales grises
 * conviennent à un en-tête de colonne ou à un groupe de liste déroulante,
 * pas à un titre qui ouvre un bloc de contenu : elles se lisent comme une
 * légende, en retrait, alors qu'elles structurent la page.
 *
 * `count` disparaît à zéro : « Jalons (0) » suivi de « Aucun jalon. » disait
 * deux fois la même chose, l'état vide suffit.
 */
export function SectionHeading({
  children,
  count,
  action,
  className = "",
}: {
  children: React.ReactNode;
  count?: number;
  /** Contrôle aligné à droite du titre (bascule de vue, bouton d'ajout). */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex flex-wrap items-baseline justify-between gap-3 ${className}`}>
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
        {children}
        {count !== undefined && count > 0 && (
          <span className="ml-2 text-sm font-semibold text-ink-muted tabular-nums">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}
