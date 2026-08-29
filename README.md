# Planning des studios — Média Animation asbl

Application de planning et d'attribution de tâches pour les studios de Média
Animation (Graphisme, Web, Vidéo, Son, Consultance). Remplace le prototype
`planning-studios-v6.jsx`, qui reste la référence fonctionnelle : voir
`docs/plan-architecture.md` pour le détail des choix et l'état d'avancement
palier par palier.

## État du projet

**Palier 2 (authentification + coquille) livré.** Ce qui existe aujourd'hui :
schéma de base de données, migrations, jeu de données de démonstration,
module de calculs sensibles avec tests, connexion par comptes nominatifs (3
rôles), garde d'accès aux routes (middleware + vérification par page),
coquille de l'application (barre latérale desktop, tiroir mobile, filtres de
studio). Les six vues (Mes tâches, Projets, Planning, Demandes, Équipe,
Réglages) sont pour l'instant des pages d'attente : leur contenu réel arrive
palier par palier — voir `docs/plan-architecture.md`.

## Pile technique

- [Next.js](https://nextjs.org) (App Router, TypeScript) — une seule
  application front + back.
- PostgreSQL via [Prisma](https://www.prisma.io) (schéma commenté en
  français, migrations versionnées dans `prisma/migrations/`).
- Authentification par comptes nominatifs ([Auth.js](https://authjs.dev)),
  conçue pour accueillir un provider Microsoft Entra ID plus tard sans
  réécriture, si Média Animation confirme l'usage de Microsoft 365.
- Fichiers joints : liens externes (SharePoint, Drive…) **et** dépôt réel
  vers un stockage compatible S3.
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

Les couleurs et polices du prototype (violets, roses, Poppins/Inter) sont
**provisoires**. Les valeurs définitives (`--ma-purple-600`, `--ma-purple-900`,
`--ma-pink-600`, `--font-display`, `--font-body`, et la charte des cinq
couleurs de studio) doivent provenir de `tokens/colors.css` et
`tokens/typography.css` — normalement produits par un projet Claude Design
séparé à partir de l'identité visuelle réelle de media-animation.be. Tant que
ces fichiers ne sont pas fournis, aucune valeur définitive n'est figée dans le
code.

## Sécurité et vie privée

- Mots de passe hachés (bcrypt), jamais stockés ni journalisés en clair.
- Base hébergée en Suisse (Infomaniak) : couverte par une décision
  d'adéquation RGPD de l'UE, mais pas un hébergement au sens strict
  "territoire UE" — point à valider explicitement avec Média Animation si une
  contrainte contractuelle l'exige.
- Sauvegardes quotidiennes automatiques de la base, avec procédure de
  restauration documentée et testée (voir `docs/` une fois le palier
  correspondant livré) — pas seulement configurées.
