# Système de design — provenance et usage réel

Ce document explique d'où viennent les jetons de style du projet et comment
ils sont réellement appliqués dans le code, qui peut diverger par endroits du
système de design brut livré (pensé d'abord pour le site vitrine
media-animation.be, pas pour une application dense).

## Provenance

Projet Claude Design séparé (`brief-claude-design.md`), à partir d'une
capture de la maquette Figma du site public media-animation.be (plugin
html.to.design) — pas de bibliothèque de composants ni de variables Figma
exploitables comme jetons de marque à la source ; les valeurs ont été
retro-conçues depuis le CSS réel de la page. Livré sous forme d'un système de
jetons (`tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`),
des polices réelles (Hanken Grotesk, Noka) et un logo (`Logo-MA-*.svg/png/pdf`
en couleur, noir et blanc), plus une maquette interactive de l'application
elle-même (`Planning Média Animation.dc.html`, cinq écrans : barre latérale,
Semaine, Projets, Tâches, Équipe, Réglages).

Fichiers reçus copiés dans le dépôt :

- Polices → `public/fonts/` (déclarées dans `src/app/globals.css`)
- Logo (variantes couleur et blanc) → `public/logo/`
- Jetons → recopiés dans `src/app/globals.css`, pas gardés comme fichiers
  séparés : un seul endroit à modifier plutôt que deux fichiers à tenir
  synchronisés.

## Couleurs

| Jeton (`globals.css`) | Valeur | Usage |
| --- | --- | --- |
| `--color-paper` | `#ffffff` | fond des pages |
| `--color-ink` | `#444444` | texte courant (dense, pas de gris/noir "neutre" générique — c'est la couleur de texte de marque pour une interface d'application) |
| `--color-ink-muted` | `rgba(68,68,68,.65)` | texte secondaire — dérivé mécaniquement de `--color-ink`, pas une couleur de marque distincte |
| `--color-heading` | `#612dfa` | titres, liens, boutons primaires, focus, indicateurs actifs |
| `--color-rail` | `#2d1592` | fond de la barre latérale |
| `--color-line` | `#dddeff` | filets, séparateurs |
| `--color-wash` | `#f7f7fc` | fond des en-têtes de tableau/grille |
| `--color-alert` | `#ff175e` | seule utilisation admise : erreurs de formulaire, signal de surcharge — jamais décoratif |
| `--color-alert-wash` | `#fdd7df` | fond des bandeaux d'erreur |

**Cinq couleurs de studio** (`Studio.fillHex` / `Studio.colorHex` en base,
pas des jetons statiques — voir `prisma/seed.ts`) : aplat clair + texte
saturé de la même teinte, contraste AA vérifié (4.5:1 minimum) :

| Studio | Aplat | Texte | Contraste |
| --- | --- | --- | --- |
| Graphisme | `#f4e9d7` | `#8b6118` | 4.58:1 |
| Web | `#d7f4f1` | `#15796f` | 4.53:1 |
| Vidéo | `#d7e4f4` | `#1a5193` | 6.17:1 |
| Son | `#e3f4d7` | `#3d7915` | 4.61:1 |
| Consultance | `#f4ded7` | `#93361a` | 5.85:1 |

Ces cinq couleurs remplacent les valeurs esquissées dans une version
antérieure du brief fonctionnel (solides + texte blanc), écrites avant que ce
travail de design existe — normal, c'est justement ce que le brief demandait
d'attendre.

**Statuts de tâche** (`--status-*`, même langage visuel que les badges
studio) : sémantiques, pas des jetons de marque — demandés en couleur par
l'utilisateur, absents de la maquette livrée (qui affichait le statut en
texte simple). À faire et En cours réutilisent des jetons de marque déjà
existants ; Validation et Livré sont deux paires ajoutées librement.

| Statut | Aplat | Texte |
| --- | --- | --- |
| À faire | `--color-wash` | `--color-ink` |
| En cours | `--color-tint` | `--color-heading` |
| Validation | `#fdecd2` | `#8a5a00` |
| Livré | `#dcf3e3` | `#1c7a3d` |

## Typographie

- `--font-display` : Noka (titres, libellés de section, chiffres de date
  dans la barre latérale) — graisses 500/600/900 utilisées.
- `--font-body` : Hanken Grotesk (tout le reste) — graisses 300 à 800 selon
  contexte.
- `font-variant-numeric: tabular-nums` posé globalement sur `<body>` :
  chiffres alignés partout où il y a des dates ou des comptages, sans y
  penser composant par composant.

L'échelle de tailles (`--text-2xs` à `--text-xl` dans `globals.css`) reprend
les tailles réellement utilisées dans les cinq écrans de la maquette, pas
l'échelle « Jetons de design » plus large qu'elle contient aussi (pensée pour
des usages marketing/hero) — l'application est dense, pas éditoriale.

## Mise en page

Angles vifs, aplats pleins, aucune ombre : voir `brief-claude-design.md`
("registre visuel plat et éditorial"), confirmé par la maquette de
l'application elle-même (aucun `border-radius` dans les écrans réels, malgré
les jetons `--radius-scoop-*`/`--radius-pill-*` définis pour le site vitrine).
On ne réutilise donc pas ces jetons de rayon ici : ils appartiennent au
registre du site public, pas à celui de l'outil interne.

## Écarts assumés par rapport à la maquette livrée

- **Navigation** : la maquette dessine cinq écrans (Semaine, Projets, Tâches,
  Équipe, Réglages). On y ajoute **Gantt**, avec le même système visuel — pas
  couvert par la maquette, mais requis par le brief fonctionnel et demandé
  explicitement (glisser-déposer des barres). « Mes tâches » et « Demandes »,
  présents dans le brief fonctionnel initial, ne sont plus des entrées de
  navigation pour l'instant — à confirmer avant le palier correspondant.
- **Création de tâche** : la maquette propose un champ « Jour » (un seul jour
  de la semaine affichée). Remplacé par deux dates (Début/Fin), pour rester
  fidèle au modèle de données réel (une tâche couvre une plage, pas un seul
  jour) — la simplification de la maquette est une commodité de démonstration
  avec des données fictives, pas une redéfinition du besoin.
- **Vue Projets/Tâches** : la maquette montre des cartes de lecture (Projets)
  et un tableau trié/cherchable (Tâches), sans édition en place. Le brief
  fonctionnel initial décrivait un tableau unique avec édition en place,
  sous-tâches dépliables, etc. Le palier actuel suit la maquette (plus rapide
  à livrer, répond au besoin immédiat de pouvoir créer projets/tâches) ;
  l'édition en place plus dense reste une amélioration possible, pas
  abandonnée.

## Logo

`public/logo/media-animation-couleur.png` (fond clair — page de connexion) et
`media-animation-blanc.png` (fond sombre — barre latérale). Bitmaps fournis
tels quels (pas de SVG disponible dans les fichiers reçus autre que la
version noire) ; à revoir si un export vectoriel devient disponible.
