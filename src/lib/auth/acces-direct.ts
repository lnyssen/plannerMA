// Accès direct, sans écran de connexion — choix temporaire.
//
// Tant que ce drapeau vaut `true` :
// - /connexion (et ses sous-pages) renvoie vers l'accueil (voir src/proxy.ts) ;
// - `auth()` (voir src/auth.ts) retombe, faute de session, sur un compte par
//   défaut : celui dont le courriel est dans ACCES_DIRECT_EMAIL s'il est
//   défini, sinon le premier compte ADMIN créé ;
// - le bouton « Déconnexion » est masqué (il ne mènerait nulle part).
//
// Pour rétablir la connexion : passer ce drapeau à `false`. Rien d'autre n'a
// été supprimé — formulaire, mots de passe et rôles sont restés en place.
export const ACCES_DIRECT = true;
