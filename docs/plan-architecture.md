# Architecture et feuille de route

Décisions validées avec Média Animation avant le début du développement
(brief `brief-claude-code.md`), et paliers de livraison. Ce document est la
version tenue à jour dans le dépôt ; il reprend le plan d'architecture soumis
et approuvé au démarrage du projet.

**État : paliers 3-4 livrés, palier 7 entamé** (Projets, Tâches, Semaine,
Gantt, Équipe, Réglages, Clients, Charge fonctionnels avec de vraies
données, y compris édition, pièces jointes réelles — fichiers et liens —,
corbeille, commentaires avec mentions, notifications par courriel et dans
l'application — voir `docs/design-system.md` pour les jetons de style réels
reçus entre-temps, et les écarts assumés par rapport à la maquette et au
plan initial : nav resserrée, Gantt et Charge ajoutés hors maquette,
création/édition par modales plutôt qu'édition en place dans le tableau).
Demandes : dépôt et notification aux administrateurs livrés, pas encore
d'écran de gestion/conversion en tâche. Prochain : palier 5 (concurrence
généralisée hors Gantt/journal), reste du palier 6 (Mes tâches, gestion des
demandes, recherche globale, exports), sauvegardes automatiques (palier 7),
accessibilité (palier 8).

## Décisions actées

| Sujet | Choix | Pourquoi |
| --- | --- | --- |
| Authentification | Comptes nominatifs (Auth.js, identifiants) au départ | Microsoft 365 non confirmé chez Média Animation ; l'architecture permet d'ajouter un provider Entra ID en une configuration, sans refonte, dès confirmation |
| Base de données | PostgreSQL + Prisma, migrations versionnées | Schéma relationnel explicite demandé par le brief, migrations traçables |
| Hébergement | Infomaniak (Jelastic Cloud) | Imposé. Suisse, hors UE stricte, mais couvert par une décision d'adéquation RGPD de l'UE |
| Fichiers joints | Liens externes conservés + dépôt réel (Object Storage compatible S3, Infomaniak) | Le brief demande de garder les deux |
| Concurrence | Écritures transactionnelles + verrouillage optimiste (`version` par ligne) + rafraîchissement court (polling ~20 s) | Le brief accepte ce compromis en repli du temps réel poussé |
| Notifications | Récap quotidien par courriel + alerte d'attribution, chacune activable par compte ; en plus, notifications dans l'application (attribution, mention, demande) toujours actives, par sondage court | Le brief exclut les notifications à chaque changement d'état, pas l'attribution/les mentions ; la cloche dans l'application répond à une demande explicite ultérieure, sur le même principe de sondage court que la concurrence (pas de temps réel) |
| Emplacement du projet | Dépôt séparé (`~/planning-studios`), hors du dépôt `design-system` | Le dépôt existant contient des travaux sans rapport |

## Paliers de livraison

Chaque palier se termine par une démo concrète, pas par un bloc final.

1. **Socle** — dépôt, Next.js + TS, schéma Prisma, migration initiale, seed de
   démonstration, module de calculs sensibles avec tests, README.
2. **Authentification + coquille** — comptes nominatifs, 3 rôles, barre
   latérale et filtres studio.
3. **Projets et tâches (vue Tableau)** — CRUD transactionnel complet.
4. **Vues Planning** — Gantt, Semaine, Charge.
5. **Concurrence + journal** — verrouillage optimiste, polling, journal des
   écritures.
6. **Reste des fonctionnalités** — Mes tâches, Demandes, Équipe, Réglages,
   recherche, exports CSV/iCal/JSON, impression.
7. **Pièces jointes réelles + notifications + sauvegardes.**
8. **Accessibilité** — clavier complet (dont Gantt), ARIA, contraste vérifié
   en CI.

Puis, dans l'ordre de priorité du brief : portail client en lecture seule,
import Outlook des absences, sélecteur SharePoint/Drive.

Déjà livrés depuis, hors plan initial : estimation de charge en
demi-journées, historique par tâche (+ journal global admin), suppression
d'un statut personnalisé, détection de dépendance circulaire, jalons + vue
Portefeuille (fusionnée depuis dans Projets, voir README), tâches
récurrentes, menu de gauche réorganisable par compte.

Portail client et import Outlook restent en attente : le premier nécessite
une décision d'authentification (lien secret par projet ? lien magique par
courriel ?) que l'utilisateur a choisi de reporter, le second des
identifiants Microsoft Graph (Azure AD) qu'on n'a pas — voir README.

## Points ouverts

- **Jetons de style** définitifs (`tokens/colors.css`, `tokens/typography.css`)
  à fournir avant de figer le moindre style — voir README.
- **Domaine d'envoi des courriels** (récap quotidien, alertes) à confirmer.
- **Confirmation Microsoft 365** — bascule vers Entra ID le cas échéant.

## Logique portée du prototype

Le prototype `planning-studios-v6.jsx` contient des fonctions pures déjà
correctes, reprises telles quelles (pas réécrites) dans
`src/lib/planning/` :

- `dates.ts` — jours fériés belges, Pâques (algorithme de Gauss), semaine
  ISO. Porté depuis les fonctions `paques`/`feriesDe`/`ferie`/`ouvrable` du
  prototype (lignes 79-105), avec un changement volontaire : calcul en UTC
  plutôt qu'en fuseau local du navigateur, parce que ce code tourne
  maintenant côté serveur.
- `tasks.ts` — avancement d'une tâche, sous-tâche en retard, conflit de
  dépendance. Porté depuis `avancement`, `enRetard` et la logique de
  chevauchement du Gantt (ligne 1121).
- `availability.ts` — charge hebdomadaire d'une personne. Porté depuis
  `chargeDe` (lignes 1421-1427), depuis complété par une répartition de
  l'effort en demi-journées (`Task.estimatedHalfDays`) sur la plage de dates
  de la tâche, plafonnée à un jour plein par jour ouvrable ; reste binaire
  par jour uniquement quand l'estimation est absente (comportement
  historique conservé).

Ces trois modules sont couverts par les tests dans
`src/lib/planning/__tests__/`.
