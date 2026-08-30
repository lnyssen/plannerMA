# Planning des studios — Média Animation asbl

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
  maximale facultative (validée à la création/édition), statut coloré,
  corbeille + destruction définitive (Réglages).
- Vue Projets (cartes internes/externes + archives), vue Tâches (tableau
  triable et cherchable), vue Semaine et vue Gantt (glisser-déposer pour
  replanifier, colonne des libellés redimensionnable, navigation par
  calendrier, double-clic pour ouvrir le détail d'une tâche).
- Vue Équipe (personnes, studios de rattachement, absences), vue Réglages
  (studios, corbeille).
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
- **Demandes** : dépôt rapide d'une demande non planifiée (« + Nouvelle
  demande »), qui notifie les administrateurs — pas encore d'écran de
  gestion/conversion en tâche dédié (backlog).
- **Charge** (admin) : occupation par personne et par semaine (jours
  ouvrables couverts par une tâche non livrée, absences déduites), avec un
  repère de chevauchement quand une personne a deux tâches actives qui se
  recoupent.
- Filtres par studio et par personne dans la liste des tâches, en plus de
  la recherche ; le Gantt signale (contour rose, double-clic pour le
  détail) les tâches d'une même personne qui se chevauchent dans le temps.

Détail palier par palier et écarts assumés par rapport au plan initial (nav
resserrée à 8+1 entrées, pas de « Mes tâches » ni d'écran de gestion des
demandes pour l'instant) : voir `docs/plan-architecture.md`.

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
