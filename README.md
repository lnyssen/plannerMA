# Studio planner — Média Animation asbl

Application de planning et d'attribution de tâches pour les studios de Média
Animation (Graphisme, Web, Vidéo, Son, Consultance). Remplace le prototype
`planning-studios-v6.jsx`, qui reste la référence fonctionnelle : voir
`docs/plan-architecture.md` pour le détail des choix et l'état d'avancement
palier par palier.

## État du projet

**Palier 3 (Projets/Tâches/Semaine/Gantt/Équipe/Réglages) livré.** Ce qui
fonctionne aujourd'hui, avec de vraies données en base :

- Connexion par comptes nominatifs (3 rôles), identité visuelle réelle.
- Créer et **modifier** des projets et des tâches (modales, depuis n'importe
  quel écran ou en cliquant une tâche/un projet existant).
- Tâches : description, pièces jointes (liens **et** fichiers déposés —
  stockage local en développement, voir `src/lib/storage/local.ts`), durée
  maximale facultative (validée à la création/édition), corbeille +
  destruction définitive (Réglages).
- **Statuts personnalisables** (Réglages → Statuts, admin) : plus de liste
  figée à quatre valeurs — un administrateur crée, renomme et réordonne les
  statuts (haut/bas), et coche « Terminé » sur ceux qui doivent compter une
  tâche à 100 % d'avancement et la sortir du calcul de charge. Une nouvelle
  tâche démarre toujours dans le premier statut. Remplace l'ancienne énumération
  fixe TODO/IN_PROGRESS/VALIDATION/DELIVERED — voir `TaskStatus` dans
  `prisma/schema.prisma`.
- Vue Projets (cartes internes/externes + archives), vue Tâches (tableau
  triable et cherchable).
- **Planning** : un seul écran, trois onglets sur les mêmes tâches — Gantt
  (par défaut ; glisser-déposer pour replanifier, colonne des libellés
  redimensionnable, navigation par calendrier, plage affichée en toutes
  lettres, en-tête fixe au défilement), Kanban (colonnes par statut, toujours
  en ligne — largeur fixe, défilement horizontal plutôt que de retomber à la
  ligne ; glisser une carte pour changer son statut — sur mobile, ouvrir la
  tâche fait la même chose depuis sa fiche) et Semaine. Changer d'onglet est
  immédiat ; la date affichée par Semaine reste dans l'URL
  (`/planning?vue=semaine&debut=…`), comme avant la fusion. Les anciennes
  adresses `/gantt`, `/semaine`, `/kanban` redirigent vers le bon onglet.
- Vue Équipe (personnes, studios de rattachement, absences), vue Réglages
  (studios, statuts, corbeille).
- **Clients** : écran dédié dans la navigation (au-dessus d'Équipe), avec
  fiche détaillée (contact, courriel, téléphone, site web, notes) — entité
  propre plutôt que du texte libre ; sélection dans une liste existante ou
  création à la volée depuis un formulaire projet.
- Effets hover/pressed cohérents sur les éléments interactifs
  (`src/components/ui/buttons.ts` centralise les styles).
- **Notifications par courriel** : alerte à l'attribution d'une tâche, récap
  quotidien des tâches en cours/à venir sous sept jours — chacune activable
  ou non par compte (« Mes notifications », en bas de la barre latérale).
  Sans SMTP configuré (développement), les courriels sont écrits dans
  `.data/mail/` plutôt qu'envoyés — voir `src/lib/mail/`. Le récap quotidien
  se déclenche via `GET /api/cron/daily-digest` (en-tête `x-cron-secret`),
  à programmer une fois par jour ouvré en production (planificateur
  Infomaniak ou cron externe) ; un bouton de test manuel existe dans
  Réglages.
- **Notifications dans l'application** (cloche, sondage court — pas de
  temps réel) : attribution d'une tâche, mention dans un commentaire,
  nouvelle demande (pour les administrateurs). Toujours actives,
  indépendamment des préférences de courriel ci-dessus.
- **Commentaires et mentions** sur une tâche (fiche de détail) : taguer
  quelqu'un (`@Nom`) via les puces proposées notifie la personne.
- **Demandes** (écran admin dédié) : dépôt rapide d'une demande non planifiée
  (« + Nouvelle demande »), qui notifie les administrateurs ; depuis
  l'écran Demandes, chacune se convertit en tâche (formulaire pré-rempli
  avec l'objet, le studio et la date souhaitée) ou s'écarte sans suite.
- **Mes tâches** : la liste des tâches, déjà filtrée sur la personne
  connectée — mêmes filtres et même fiche de détail que la vue Tâches.
- **Recherche globale** (loupe, barre latérale) : tâches, projets et clients,
  résultats groupés, ouvre directement la fiche correspondante.
- **Sous-tâches** et **dépendances** sur une tâche (fiche de détail) :
  checklist avec échéance facultative pour les premières ; sélection d'une
  tâche prédécesseure pour les secondes, visualisée dans le Gantt (déjà
  affichée avant, mais jusqu'ici sans moyen de la définir depuis l'appli).
- **Charge** (admin) : occupation par personne et par semaine (jours
  ouvrables couverts par une tâche non livrée, absences déduites), avec un
  repère de chevauchement quand une personne a deux tâches actives qui se
  recoupent. Complétée par des statistiques d'ensemble (charge moyenne de
  l'équipe, nombre de personnes en surcharge, chevauchements détectés,
  répartition moyenne par studio) et une colonne « Moyenne » par personne.
- Filtres par studio et par personne dans la liste des tâches et l'onglet
  Kanban, en plus de la recherche ; la liste des tâches affiche aussi le
  client et le type (interne/externe) du projet. Le Gantt signale (contour
  rose, double-clic pour le détail) les tâches d'une même personne qui se
  chevauchent dans le temps, redimensionne vraiment sa zone défilable selon
  le nombre de semaines choisi, et se pilote au clavier (une barre au focus :
  Flèches pour la décaler, Maj+Flèches pour ajuster sa durée, Entrée pour
  l'ouvrir) — pas seulement à la souris. Les colonnes du Kanban restent à
  largeur raisonnable plutôt que de s'étirer sur un grand écran.
- Fenêtres modales : celle d'une tâche est plus large (deux colonnes) et,
  comme toutes les autres, défile plutôt que de déborder de l'écran si le
  contenu est trop long. Le panneau de notifications ne se fait plus
  tronquer par la colonne latérale.
- **Historique par tâche** : onglet « Historique » repliable dans la fiche
  de détail, listant les écritures journal (`JournalEntry`) propres à cette
  tâche — création, modification, changement de statut, replanification,
  mise à la corbeille — avec auteur et horodatage. Un **journal global**
  équivalent existe aussi côté admin (Réglages → Journal, 100 dernières
  écritures tous types confondus), avec lien direct vers la tâche concernée
  quand il y en a une.
- **Suppression d'un statut** (Réglages → Statuts, admin) : refusée si c'est
  le dernier statut restant ou si des tâches l'utilisent encore (message
  donnant le nombre concerné) — évite de casser la clé étrangère `Task.status`.
- **Détection de dépendance circulaire** : impossible de faire dépendre une
  tâche d'une autre qui dépend déjà (directement ou via la chaîne) d'elle —
  rejeté à l'enregistrement avec un message explicite plutôt que de créer une
  boucle indétectable dans le Gantt.
- **Estimation de charge en demi-journées** (fiche de tâche, champ « Estim.
  (demi-j) », facultatif) : la vue Charge répartit l'effort réel sur la plage
  de dates de la tâche (plafonné à une journée pleine par jour ouvrable) au
  lieu de compter tout jour couvert comme entièrement occupé ; sans
  estimation, l'ancien comportement binaire reste inchangé. Résout la
  limitation « pas encore une estimation de charge réelle » signalée dans
  `docs/plan-architecture.md`.
- **Jalons** : chaque projet peut porter des jalons datés (fiche projet,
  section « Jalons » — titre, échéance, coché une fois atteint), et la fiche
  projet liste aussi ses tâches (statut, personne, date), cliquables vers la
  fiche tâche complète.
- **Vue Projets à deux présentations** : bascule Cartes/Tableau (mémorisée
  par appareil) au-dessus de la liste. Cartes pour parcourir/éditer ; Tableau
  pour comparer tous les projets d'un coup — trié par urgence (jalons en
  retard d'abord, puis avancement le plus faible), avec avancement, studios,
  prochain jalon et compteur de retard par ligne, filtrable par studio.
  Fusion de l'ancien écran séparé « Portefeuille » dans Projets — mêmes
  données, un bouton bascule plutôt que deux entrées de nav.
- **Tâches récurrentes** (fiche de tâche, section « Récurrence » — chaque
  semaine ou chaque mois, tous les N, jusqu'à une date facultative) : quand
  une tâche récurrente passe à un statut « Terminé », l'occurrence suivante
  est créée automatiquement (dates décalées, repart au premier statut), sans
  job planifié ni file d'attente — déclenché directement par le changement de
  statut. Un garde-fou (`Task.recurrenceParentId`) empêche de générer deux
  fois la même suite si le statut repasse par « Terminé ».
- **Menu de gauche réorganisable** : « Réorganiser le menu », en bas de la
  barre latérale (sous « Mes notifications »), ouvre une modale avec des
  flèches haut/bas par entrée — propre à chaque compte (`User.navOrder`),
  sans effet sur les autres utilisateurs. « Ordre par défaut » réinitialise.
- **Champ « Équipe ou service »** (fiche personne, Équipe → Ajouter/Modifier) :
  texte libre, séparé des cases à cocher « Studios de rattachement » —
  permet un intitulé comme « Projets Européens » ou « EP » sans que ce soit
  traité comme un studio. Regroupe aussi les personnes sur la page Équipe.
- **Menu repliable** : le bouton en haut de la barre latérale (icône panneau)
  la réduit à une colonne d'icônes (survol pour le libellé), pour libérer de
  la largeur — préférence locale à l'appareil (pas propre au compte, contrairement
  à l'ordre du menu). L'entrée active est surlignée en pastille arrondie
  plutôt que par un trait sur le bord, et « Mes tâches »/« Demandes »
  affichent une puce avec le nombre en attente quand il y en a.
- **Bords arrondis** dans toute l'application (boutons, cartes, champs,
  modales, puces de statut/studio) — jetons `rounded-md`/`rounded-lg` plutôt
  que des angles droits partout, plus proche de la maquette Claude Design
  d'origine. Le fond de la barre latérale utilise désormais la même teinte
  violette que les titres/bordures actives (`#612DFA`, contraste AA conservé
  avec le texte blanc).

Détail palier par palier et écarts assumés par rapport au plan initial (nav à
6+3 entrées — Kanban/Semaine/Gantt fusionnés en un seul « Planning », Charge/
Demandes/Réglages réservés aux administrateurs) : voir
`docs/plan-architecture.md`.

## Pile technique

- [Next.js](https://nextjs.org) (App Router, TypeScript) — une seule
  application front + back.
- PostgreSQL via [Prisma](https://www.prisma.io) (schéma commenté en
  français, migrations versionnées dans `prisma/migrations/`).
- Authentification par comptes nominatifs ([Auth.js](https://authjs.dev)),
  conçue pour accueillir un provider Microsoft Entra ID plus tard sans
  réécriture, si Média Animation confirme l'usage de Microsoft 365.
- Fichiers joints : liens externes (SharePoint, Drive…) **et** dépôt réel de
  fichiers — stockage local du serveur en développement
  (`src/lib/storage/local.ts`, servi via une route authentifiée), à
  remplacer par l'Object Storage Infomaniak en production (seul ce fichier
  change, pas le reste du code).
- Courriels (alerte d'attribution, récap quotidien) via
  [Nodemailer](https://nodemailer.com) — sans `SMTP_HOST` configuré
  (développement), écrits dans `.data/mail/` plutôt qu'envoyés, à remplacer
  par Infomaniak Mail ou un autre fournisseur SMTP en production (seul
  `src/lib/mail/transport.ts` change).
- Hébergement cible : Infomaniak (Jelastic Cloud + Object Storage).

## Installation (développement local)

Deux façons équivalentes de fournir PostgreSQL ; choisissez l'une des deux.

### Option A — Docker (recommandée, la plus proche de la production)

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Option B — PostgreSQL installé localement (Homebrew sur macOS)

```bash
brew install postgresql@16
brew services start postgresql@16
createuser -s planning_studios
psql -d postgres -c "ALTER USER planning_studios WITH PASSWORD 'planning_studios_dev';"
createdb -O planning_studios planning_studios_dev

cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Dans les deux cas, ouvrez <http://localhost:3000>. Deux comptes de
démonstration sont créés par le seed — **mots de passe à changer avant tout
déploiement réel** :

| Rôle | Courriel | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin@media-animation.be` | `changez-moi` |
| Collaborateur | `bilal@media-animation.be` | `changez-moi` |

### Scripts utiles

| Commande            | Effet                                                |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`         | Serveur de développement                              |
| `npm run build`       | Build de production                                   |
| `npm run test`        | Tests (Vitest) — calculs de dates, charge, dépendances |
| `npm run db:migrate`  | Crée/applique une migration Prisma                    |
| `npm run db:seed`     | Recharge le jeu de données de démonstration            |
| `npm run db:studio`   | Explorateur de données Prisma Studio                   |

## Jetons de style

Réels, plus provisoires : couleurs, polices (Noka + Hanken Grotesk, fichiers
dans `public/fonts/`) et logo (`public/logo/`) viennent d'un projet Claude
Design séparé, à partir de l'identité visuelle réelle de media-animation.be.
Tout est centralisé dans `src/app/globals.css` — c'est le seul fichier à
modifier si la charte évolue. Détail complet, provenance et écarts assumés
par rapport aux jetons livrés : voir `docs/design-system.md`.

Les cinq couleurs de studio (`Studio.fillHex`/`Studio.colorHex` en base) ont
été redéfinies par ce travail de design en paires aplat clair / texte saturé,
contraste AA vérifié — elles remplacent les valeurs (solides, texte blanc)
esquissées dans une première version du brief, avant que ce travail
n'existe.

## Sécurité et vie privée

- Mots de passe hachés (bcrypt), jamais stockés ni journalisés en clair.
- Base hébergée en Suisse (Infomaniak) : couverte par une décision
  d'adéquation RGPD de l'UE, mais pas un hébergement au sens strict
  "territoire UE" — point à valider explicitement avec Média Animation si une
  contrainte contractuelle l'exige.
- Sauvegardes quotidiennes automatiques de la base, avec procédure de
  restauration documentée et testée (voir `docs/` une fois le palier
  correspondant livré) — pas seulement configurées.
