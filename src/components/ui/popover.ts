/**
 * La surface commune des panneaux flottants — menu du profil, panneau de
 * notifications.
 *
 * Les deux avaient divergé : les notifications sur fond papier, le profil en
 * noir translucide avec un flou d'arrière-plan qui, posé sur le violet de la
 * barre, virait au gris laiteux et rendait le survol illisible. Deux surfaces
 * pour le même geste — « j'ouvre un petit panneau au-dessus du reste ».
 *
 * Choix retenu : le papier. Un panneau clair au-dessus d'une barre sombre se
 * détache sans effet, reste lisible quel que soit ce qu'il recouvre, et suit
 * le même jeu de jetons que le reste de l'application. L'ombre porte la
 * profondeur, pas la transparence.
 */
export const popoverSurfaceClass =
  "overflow-hidden rounded-xl border border-line bg-paper shadow-[0_16px_40px_-12px_rgba(45,21,146,0.28)]";

/** En-tête du panneau : titre discret à gauche, action facultative à droite. */
export const popoverHeaderClass =
  "flex flex-shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5";

/** Libellé de l'en-tête. */
export const popoverTitleClass = "text-xs font-semibold tracking-wide text-ink-muted uppercase";

/**
 * Une ligne cliquable du panneau. Le retrait est un peu plus serré que celui
 * de l'en-tête : le menu du profil est bridé par la largeur de la barre
 * latérale, et « Changer de mot de passe » passait à la ligne pour trois
 * pixels.
 */
export const popoverItemClass =
  "flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors duration-100 hover:bg-wash active:bg-line";

/** Séparation entre deux groupes de lignes. */
export const popoverGroupClass = "border-t border-line py-1";
