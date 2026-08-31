// Classes de bouton partagées — un seul endroit pour les états hover/pressed
// de toute l'application. Registre plat (pas d'ombre, pas de dégradé) :
// le retour visuel passe par l'opacité et une légère mise à l'échelle au
// clic, jamais par une élévation.

export const primaryButtonClass =
  "rounded-lg bg-heading text-paper transition-[opacity,transform] duration-100 hover:opacity-85 active:scale-[0.97] active:opacity-100 disabled:opacity-60 disabled:active:scale-100";

export const secondaryButtonClass =
  "rounded-lg border-[1.5px] border-heading text-heading bg-transparent transition-colors duration-100 hover:bg-heading/10 active:bg-heading/15";

export const dangerButtonClass =
  "rounded-lg text-alert transition-colors duration-100 hover:bg-alert-wash active:bg-alert-wash";

export const dangerOutlineButtonClass =
  "rounded-lg border-[1.5px] border-alert text-alert bg-transparent transition-colors duration-100 hover:bg-alert-wash active:bg-alert-wash";

/** Bouton texte simple (icône + libellé, sans bordure) — liens d'action type "Restaurer". */
export const textButtonClass = "rounded-md transition-opacity duration-100 hover:opacity-70 active:opacity-100";

// Variantes pour la barre latérale (fond violet --color-rail) : mêmes
// principes (opacité + léger tassement au clic), déclinés en blanc.
export const primaryOnRailButtonClass =
  "rounded-lg bg-white text-rail transition-[opacity,transform] duration-100 hover:opacity-85 active:scale-[0.97] active:opacity-100";

export const secondaryOnRailButtonClass =
  "rounded-lg border-[1.5px] border-white text-white bg-transparent transition-colors duration-100 hover:bg-white/10 active:bg-white/20";

export const iconButtonOnRailClass =
  "rounded-md text-white transition-opacity duration-100 hover:opacity-75 active:opacity-100";
