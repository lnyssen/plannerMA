// Classes de bouton partagées — un seul endroit pour les états hover/pressed
// de toute l'application. Pas d'ombre/dégradé : le retour visuel passe par
// l'opacité et une légère mise à l'échelle au clic, jamais par une
// élévation. Forme pilule (`rounded-full`) + hauteur fixe (`h-10`, alignée
// sur `fieldInputClass`) : un bouton et un champ posés côte à côte (barre de
// filtres, pied de formulaire) doivent toujours arriver à la même hauteur —
// avant, chaque appelant fixait sa propre paire padding/rayon.
const BUTTON_BASE = "flex h-10 items-center justify-center rounded-full";

export const primaryButtonClass =
  `${BUTTON_BASE} bg-heading text-paper transition-[opacity,transform] duration-100 hover:opacity-85 active:scale-[0.97] active:opacity-100 disabled:opacity-60 disabled:active:scale-100`;

export const secondaryButtonClass =
  `${BUTTON_BASE} border-[1.5px] border-heading text-heading bg-transparent transition-colors duration-100 hover:bg-heading/10 active:bg-heading/15`;

export const dangerButtonClass =
  `${BUTTON_BASE} text-alert transition-colors duration-100 hover:bg-alert-wash active:bg-alert-wash`;

export const dangerOutlineButtonClass =
  `${BUTTON_BASE} border-[1.5px] border-alert text-alert bg-transparent transition-colors duration-100 hover:bg-alert-wash active:bg-alert-wash`;

/** Bouton texte simple (icône + libellé, sans bordure) — liens d'action type "Restaurer". Pas de hauteur fixe : vit inline dans du texte, pas dans une barre d'actions. */
export const textButtonClass = "rounded-full transition-opacity duration-100 hover:opacity-70 active:opacity-100";

// Variantes pour la barre latérale (fond violet --color-rail) : mêmes
// principes (opacité + léger tassement au clic), déclinés en blanc.
export const primaryOnRailButtonClass =
  "flex h-10 items-center justify-center rounded-full bg-white text-rail transition-[opacity,transform] duration-100 hover:opacity-85 active:scale-[0.97] active:opacity-100";

export const secondaryOnRailButtonClass =
  "flex h-10 items-center justify-center rounded-full border-[1.5px] border-white text-white bg-transparent transition-colors duration-100 hover:bg-white/10 active:bg-white/20";

export const iconButtonOnRailClass =
  "rounded-full text-white transition-opacity duration-100 hover:opacity-75 active:opacity-100";
