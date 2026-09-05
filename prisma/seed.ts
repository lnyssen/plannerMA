// Jeu de données de démonstration : les cinq studios de Média Animation, une
// poignée de personnes, deux projets (un interne, un externe) avec quelques
// tâches et sous-tâches, une absence et un compte administrateur.
//
// `npm run db:seed` (ou automatiquement après `prisma migrate dev`).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDaysIso, today } from "../src/lib/planning/dates";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Jetons réels (Claude Design, à partir de media-animation.be) : chaque
// studio associe un aplat clair (fillHex) et un texte saturé (colorHex) de
// la même teinte, contraste AA vérifié — remplace les valeurs provisoires
// du brief initial (solides + texte blanc), désormais obsolètes.
const STUDIOS = [
  { slug: "graphisme", name: "Graphisme", fillHex: "#f4e9d7", colorHex: "#8b6118", initial: "G" }, // AA 4.58:1
  { slug: "web", name: "Web", fillHex: "#d7f4f1", colorHex: "#15796f", initial: "W" }, // AA 4.53:1
  { slug: "video", name: "Vidéo", fillHex: "#d7e4f4", colorHex: "#1a5193", initial: "V" }, // AA 6.17:1
  { slug: "son", name: "Son", fillHex: "#e3f4d7", colorHex: "#3d7915", initial: "S" }, // AA 4.61:1
  { slug: "consultance", name: "Consultance", fillHex: "#f4ded7", colorHex: "#93361a", initial: "C" }, // AA 5.85:1
];

// Statuts par défaut (personnalisables depuis Réglages une fois l'appli en
// service — voir prisma/migrations/20260830150000_customizable_task_statuses).
const STATUSES = [
  { key: "todo", name: "À faire", fillHex: "#f7f7fc", colorHex: "#444444", isDone: false },
  { key: "inProgress", name: "En cours", fillHex: "#b9bbff", colorHex: "#612dfa", isDone: false },
  { key: "validation", name: "Validation", fillHex: "#fdecd2", colorHex: "#8a5a00", isDone: false },
  { key: "delivered", name: "Livré", fillHex: "#dcf3e3", colorHex: "#1c7a3d", isDone: true },
];

/** Le compte avec lequel on ouvre la démonstration : c'est lui qui doit voir les notifications. */
const COMPTE_DEMO = "admin@media-animation.be";

async function main() {
  // Projets/tâches/absences ne sont pas des données nominatives réelles :
  // on repart de zéro à chaque semis plutôt que d'accumuler des doublons à
  // chaque exécution. Studios, personnes et comptes restent stables (upsert
  // par clé naturelle) puisqu'on veut pouvoir re-semer sans casser les liens
  // déjà créés en développement.
  // Garde-fou avant tout effacement. Le semis efface projets, tâches et
  // écritures : pointé par erreur vers une base en service, il détruirait du
  // travail réel. Le nombre d'écritures de temps est le meilleur indicateur —
  // une base de démonstration en a peu, une base utilisée en a beaucoup, et
  // ce sont elles qui justifient des subventions.
  const ecrituresExistantes = await db.timeEntry.count();
  const SEUIL = 100;
  if (ecrituresExistantes > SEUIL && process.env.SEED_FORCE !== "1") {
    console.error(
      `\n⛔ Semis interrompu : cette base contient déjà ${ecrituresExistantes} écritures de temps (seuil : ${SEUIL}).\n` +
        `   Elle semble être en service, et le semis effacerait ces heures.\n` +
        `   Si vous êtes certain de vouloir tout remplacer, relancez avec SEED_FORCE=1.\n`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("Nettoyage des données de démonstration précédentes…");
  // Les notifications pointent vers des tâches (liens /taches?open=…) qui
  // vont être recréées avec de nouveaux identifiants ci-dessous : les garder
  // laisserait des liens morts pointant vers des tâches qui n'existent plus.
  await db.timeEntry.deleteMany();
  await db.timesheetPeriod.deleteMany();
  await db.notification.deleteMany();
  await db.comment.deleteMany(); // cascade : supprime aussi les mentions liées
  await db.attachment.deleteMany();
  await db.subtask.deleteMany();
  await db.journalEntry.deleteMany();
  await db.task.deleteMany();
  await db.absence.deleteMany();
  await db.request.deleteMany();
  await db.project.deleteMany();

  console.log("Semis des studios…");
  const studios: Record<string, string> = {};
  for (const [i, s] of STUDIOS.entries()) {
    const studio = await db.studio.upsert({
      where: { slug: s.slug },
      update: s,
      create: { ...s, position: i },
    });
    studios[s.slug] = studio.id;
  }

  console.log("Semis des statuts…");
  const statuses: Record<string, string> = {};
  for (const [i, s] of STATUSES.entries()) {
    const status = await db.taskStatus.upsert({
      where: { name: s.name },
      update: { fillHex: s.fillHex, colorHex: s.colorHex, isDone: s.isDone, position: i },
      create: { name: s.name, fillHex: s.fillHex, colorHex: s.colorHex, isDone: s.isDone, position: i },
    });
    statuses[s.key] = status.id;
  }

  // Nomenclature transmise par l'équipe ("Suivi hebdo du temps de
  // travail — nomenclature commune") : catégories générales disponibles
  // pour tous les studios, plus des catégories spécifiques par studio.
  // "Design" (PDF) correspond au studio "Graphisme" de l'app.
  console.log("Semis des catégories de tâches…");
  const GENERAL_CATEGORIES = [
    "Préparation projet",
    "Administratif",
    "Formation",
    "Réunion interne",
    "Réunion client",
    "Réunion projet",
    "Coordination",
    "Suivi projet",
    "Devis",
    "Support interne",
    "Organisation",
    "Absence",
  ];
  const STUDIO_CATEGORIES: Record<string, string[]> = {
    web: ["Développement", "Support technique", "Corrections", "UX", "Design", "Accessibilité", "Documentation"],
    graphisme: ["Design"],
    consultance: ["Consultance", "Formation", "Rapport", "Rédaction éditoriale"],
    video: ["Motion design", "Écriture", "Dérush", "Montage", "Production"],
    son: ["Enregistrement", "Montage"],
  };
  for (const [i, name] of GENERAL_CATEGORIES.entries()) {
    // Pas d'upsert par clé composite ici : un index unique (studioId, name)
    // ne matche jamais deux valeurs NULL entre elles en PostgreSQL, donc
    // Prisma ne type même pas `null` comme filtre valide dans ce cas.
    const existing = await db.taskCategory.findFirst({ where: { studioId: null, name } });
    if (existing) {
      await db.taskCategory.update({ where: { id: existing.id }, data: { position: i } });
    } else {
      await db.taskCategory.create({ data: { name, position: i } });
    }
  }
  for (const [slug, names] of Object.entries(STUDIO_CATEGORIES)) {
    for (const [i, name] of names.entries()) {
      await db.taskCategory.upsert({
        where: { studioId_name: { studioId: studios[slug], name } },
        update: { position: i },
        create: { name, studioId: studios[slug], position: i },
      });
    }
  }

  console.log("Semis de l'équipe…");
  const people: Record<string, string> = {};
  const PEOPLE = [
    { key: "amelie", name: "Amélie Verstraeten", studioSlugs: ["graphisme"], email: "amelie@media-animation.be" },
    { key: "bilal", name: "Bilal Haddouchi", studioSlugs: ["web"], email: "bilal@media-animation.be" },
    { key: "chloe", name: "Chloé Dubois", studioSlugs: ["video", "son"], email: "chloe@media-animation.be" },
    { key: "driss", name: "Driss El Amrani", studioSlugs: ["consultance"], email: "driss@media-animation.be" },
    { key: "elena", name: "Eléna Petit", studioSlugs: ["graphisme", "web"], team: "Direction", email: "elena@media-animation.be" },
  ];
  for (const p of PEOPLE) {
    const person = await db.person.upsert({
      where: { id: p.key }, // clé arbitraire stable pour le seed uniquement
      update: {},
      create: {
        id: p.key,
        name: p.name,
        team: p.team ?? "Studios",
        email: p.email,
        studios: { create: p.studioSlugs.map((slug) => ({ studioId: studios[slug] })) },
      },
    });
    people[p.key] = person.id;
  }

  // Les comptes de démonstration portent un mot de passe public ("changez-moi").
  // Les créer sur une base distante reviendrait à ouvrir un accès
  // administrateur en clair sur une URL publique : sur autre chose que
  // localhost, on ne crée donc aucun compte. Ceux qui existent déjà ne sont de
  // toute façon jamais modifiés (`update: {}`), un semis ne réinitialise
  // jamais un mot de passe en service.
  const baseLocale = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

  const COMPTES_DEMO = [
    { email: COMPTE_DEMO, role: "ADMIN" as const, personKey: "elena" },
    { email: "bilal@media-animation.be", role: "COLLABORATOR" as const, personKey: "bilal" },
  ];

  for (const compte of COMPTES_DEMO) {
    const existant = await db.user.findUnique({ where: { email: compte.email }, select: { id: true } });
    if (existant) {
      console.log(`Compte ${compte.email} déjà présent — inchangé.`);
      continue;
    }
    if (!baseLocale) {
      console.warn(
        `⚠️  Compte ${compte.email} NON créé : la base visée n'est pas locale, et ce compte aurait le mot de passe public « changez-moi ». Créez-le depuis Équipe, avec un vrai mot de passe.`,
      );
      continue;
    }
    console.log(`Semis du compte ${compte.email} (mot de passe : changez-moi)…`);
    await db.user.create({
      data: {
        email: compte.email,
        passwordHash: await bcrypt.hash("changez-moi", 12),
        role: compte.role,
        personId: people[compte.personKey],
      },
    });
  }

  console.log("Semis des clients, projets et tâches…");
  const auj = today();

  // Générateur déterministe : deux semis successifs produisent exactement le
  // même jeu de données. Indispensable pour comparer un écran d'une fois sur
  // l'autre, et pour que les captures de la documentation restent stables.
  let graine = 20260902;
  const alea = () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
  const entre = (min: number, max: number) => min + Math.floor(alea() * (max - min + 1));
  const parmi = <T,>(xs: T[]) => xs[Math.floor(alea() * xs.length)];

  const CLIENTS = [
    { name: "Média Animation — communication interne", type: "INTERNAL" as const },
    { name: "Oxfam Belgique", type: "EXTERNAL" as const },
    { name: "Fédération Wallonie-Bruxelles", type: "EXTERNAL" as const },
    { name: "Commission européenne — DG CONNECT", type: "EXTERNAL" as const },
    { name: "CNCD-11.11.11", type: "EXTERNAL" as const },
    { name: "Ligue des familles", type: "EXTERNAL" as const },
  ];
  const clients: Record<string, string> = {};
  for (const c of CLIENTS) {
    const row = await db.client.upsert({ where: { name: c.name }, update: { type: c.type }, create: { name: c.name, type: c.type } });
    clients[c.name] = row.id;
  }

  // Budgets calibrés pour que chaque état du Tableau de bord soit visible sur
  // au moins un projet : dans les temps, en avance, en retard de consommation,
  // et franchement dépassé.
  const PROJETS = [
    { key: "vitrine", name: "Refonte du site vitrine", code: "SITE-1", client: CLIENTS[0].name, pole: "FONCTIONNEMENT" as const, budget: 220, studios: ["web", "graphisme"] },
    { key: "oxfam", name: "Campagne de sensibilisation", code: "OXFAM-2", client: CLIENTS[1].name, pole: null, budget: 180, studios: ["video", "consultance"] },
    { key: "mediaEduc", name: "Parcours d’éducation aux médias", code: "FWB-EDUC", client: CLIENTS[2].name, pole: "EQUIPE_EDUCATIVE" as const, budget: 320, studios: ["consultance", "graphisme"] },
    { key: "digicit", name: "DigiCitizen — capsules européennes", code: "EU-DIGI", client: CLIENTS[3].name, pole: "EUROPEEN" as const, budget: 400, studios: ["video", "son", "web"] },
    { key: "climat", name: "Mobilisation climat", code: "CNCD-CLIM", client: CLIENTS[4].name, pole: null, budget: 120, studios: ["graphisme"] },
    { key: "parentalite", name: "Podcast parentalité", code: "LDF-POD", client: CLIENTS[5].name, pole: "EDUCATION_PERMANENTE" as const, budget: 150, studios: ["son", "consultance"] },
    { key: "ep2026", name: "Éducation permanente 2026", code: "EP-2026", client: CLIENTS[0].name, pole: "EDUCATION_PERMANENTE" as const, budget: 500, studios: ["consultance", "web", "video"], modele: true },
    { key: "intranet", name: "Intranet — refonte", code: null, client: CLIENTS[0].name, pole: "FONCTIONNEMENT" as const, budget: null, studios: ["web"] },
    { key: "archive", name: "Expo itinérante 2025", code: "EXPO-25", client: CLIENTS[2].name, pole: null, budget: 90, studios: ["graphisme", "video"], archived: true },
  ];

  const projets: Record<string, string> = {};
  for (const p of PROJETS) {
    const row = await db.project.create({
      data: {
        name: p.name,
        code: p.code,
        clientId: clients[p.client],
        pole: p.pole,
        budgetHours: p.budget,
        archived: p.archived ?? false,
        isTemplate: (p as { modele?: boolean }).modele ?? false,
        studios: { create: p.studios.map((s) => ({ studioId: studios[s] })) },
      },
    });
    projets[p.key] = row.id;
  }

  // Dates clés : quelques-unes dépassées (le Tableau de bord les remonte en rouge),
  // d'autres à venir dans les trente jours, d'autres déjà faits.
  const JALONS = [
    { projet: "digicit", title: "Livraison du pilote", jours: -6, fait: false },
    { projet: "mediaEduc", title: "Validation du parcours par la FWB", jours: 9, fait: false },
    { projet: "oxfam", title: "Diffusion de la campagne", jours: 21, fait: false },
    { projet: "ep2026", title: "Dépôt du dossier EP", jours: 44, fait: false },
    { projet: "vitrine", title: "Recette technique", jours: -20, fait: true },
    { projet: "climat", title: "Bon à tirer affiches", jours: 4, fait: false },
    { projet: "climat", title: "Validation du visuel par le comité", jours: -3, fait: false },
  ];
  for (const j of JALONS) {
    await db.milestone.create({
      data: { projectId: projets[j.projet], title: j.title, dueDate: new Date(addDaysIso(auj, j.jours)), isDone: j.fait },
    });
  }

  // Tâches : l'étalement des dates couvre le passé (pour les écritures de
  // temps), le présent et l'à-venir (pour le Gantt et Semaine). Plusieurs sont
  // volontairement en retard ou non attribuées, pour que les compteurs
  // d'alerte du menu et du Tableau de bord aient de quoi signaler.
  const TACHES: {
    /** Nul = travail hors projet (« AGENCE ») — Task.projectId est facultatif. */
    projet: string | null;
    title: string;
    /** Quelques tâches en portent une : une fiche sans description ne montre
     *  rien de ce que la fiche sait faire, en démonstration comme en capture. */
    description?: string;
    studios: string[];
    qui: string | null;
    debut: number;
    fin: number;
    statut: keyof typeof statuses;
    demiJours?: number;
    /** Nul = pas d'estimation : la vue Charge compte alors la plage entière comme occupée. */
    maxJours?: number;
    /** Jours écoulés depuis la mise à la corbeille. */
    corbeille?: number;
    sousTaches?: [string, number, boolean][];
  }[] = [
    { projet: "vitrine", title: "Arborescence et wireframes", studios: ["web"], qui: "bilal", debut: -34, fin: -22, statut: "delivered", demiJours: 8, sousTaches: [["Page d’accueil", -30, true], ["Pages studios", -24, true]] },
    { projet: "vitrine", title: "Charte graphique déclinée au site", studios: ["graphisme"], qui: "amelie", debut: -20, fin: -6, statut: "delivered", demiJours: 10 },
    { projet: "vitrine", title: "Intégration front", description: "Intégration des maquettes validées, en commençant par les gabarits partagés (en-tête, pied de page, cartes). Le formulaire d’inscription attend la validation juridique, on le garde pour la fin.", studios: ["web"], qui: "bilal", debut: -5, fin: 6, statut: "inProgress", demiJours: 12, sousTaches: [["Composants de base", 1, true], ["Pages de contenu", 5, false]] },
    { projet: "vitrine", title: "Rédaction des contenus", studios: ["consultance"], qui: null, debut: -3, fin: 8, statut: "todo", demiJours: 6 },
    { projet: "oxfam", title: "Cadrage stratégique avec le client", studios: ["consultance"], qui: "driss", debut: -12, fin: -9, statut: "delivered", demiJours: 4 },
    { projet: "oxfam", title: "Écriture du scénario", studios: ["video"], qui: "chloe", debut: -8, fin: -2, statut: "validation", demiJours: 6 },
    { projet: "oxfam", title: "Tournage sur site", studios: ["video", "son"], qui: "chloe", debut: 3, fin: 5, statut: "todo", demiJours: 6 },
    { projet: "oxfam", title: "Montage et étalonnage", studios: ["video"], qui: "chloe", debut: 8, fin: 15, statut: "todo", demiJours: 8 },
    { projet: "mediaEduc", title: "État des lieux des pratiques", studios: ["consultance"], qui: "driss", debut: -40, fin: -25, statut: "delivered", demiJours: 14 },
    { projet: "mediaEduc", title: "Conception des modules", studios: ["consultance"], qui: "driss", debut: -18, fin: -1, statut: "validation", demiJours: 20 },
    { projet: "mediaEduc", title: "Maquettes des supports", studios: ["graphisme"], qui: "amelie", debut: -9, fin: -2, statut: "inProgress", demiJours: 8 },
    { projet: "mediaEduc", title: "Test en classe", studios: ["consultance"], qui: null, debut: 12, fin: 19, statut: "todo", demiJours: 6 },
    { projet: "digicit", title: "Kick-off consortium", studios: ["consultance"], qui: "elena", debut: -55, fin: -54, statut: "delivered", demiJours: 2 },
    { projet: "digicit", title: "Écriture des capsules", description: "Un script par capsule, relu par le partenaire allemand avant tournage. Ton direct, tutoiement, pas plus de 450 mots — au-delà, ça ne tient pas dans les 3 minutes.", studios: ["video", "consultance"], qui: "chloe", debut: -30, fin: -12, statut: "delivered", demiJours: 16 },
    { projet: "digicit", title: "Tournage capsules 1 à 4", description: "Quatre capsules de 3 minutes, tournées en deux jours au studio et deux jours en extérieur. Prévoir le fond vert pour les séquences 2 et 4, et un micro-cravate de secours : la dernière captation en extérieur avait souffert du vent.", studios: ["video"], qui: "chloe", debut: -11, fin: -4, statut: "inProgress", demiJours: 12 },
    { projet: "digicit", title: "Habillage sonore", studios: ["son"], qui: "chloe", debut: -7, fin: -3, statut: "todo", demiJours: 6 },
    { projet: "digicit", title: "Sous-titrage multilingue", studios: ["web"], qui: null, debut: 1, fin: 12, statut: "todo", demiJours: 10 },
    { projet: "digicit", title: "Rapport intermédiaire", studios: ["consultance"], qui: "elena", debut: 14, fin: 20, statut: "todo", demiJours: 5 },
    { projet: "climat", title: "Affiches et déclinaisons", studios: ["graphisme"], qui: "amelie", debut: -6, fin: 2, statut: "inProgress", demiJours: 8 },
    { projet: "climat", title: "Kit réseaux sociaux", studios: ["graphisme"], qui: "amelie", debut: 3, fin: 9, statut: "todo", demiJours: 5 },
    { projet: "parentalite", title: "Repérage des intervenants", studios: ["consultance"], qui: "driss", debut: -15, fin: -8, statut: "delivered", demiJours: 5 },
    { projet: "parentalite", title: "Enregistrement épisodes 1-3", studios: ["son"], qui: "chloe", debut: -2, fin: 4, statut: "inProgress", demiJours: 9 },
    { projet: "parentalite", title: "Montage et mixage", studios: ["son"], qui: null, debut: 6, fin: 13, statut: "todo", demiJours: 8 },
    { projet: "ep2026", title: "Programme des animations", studios: ["consultance"], qui: "driss", debut: -45, fin: -20, statut: "delivered", demiJours: 22 },
    { projet: "ep2026", title: "Plateforme d’inscription", studios: ["web"], qui: "bilal", debut: -14, fin: -1, statut: "validation", demiJours: 14 },
    { projet: "ep2026", title: "Captation des rencontres", studios: ["video", "son"], qui: "chloe", debut: 7, fin: 18, statut: "todo", demiJours: 12 },
    { projet: "ep2026", title: "Bilan quantitatif", studios: ["consultance"], qui: "elena", debut: 24, fin: 30, statut: "todo", demiJours: 6 },
    { projet: "intranet", title: "Recueil des besoins", studios: ["web"], qui: "bilal", debut: -3, fin: 5, statut: "todo", demiJours: 5 },
    { projet: "intranet", title: "Maquette", studios: ["graphisme"], qui: null, debut: 9, fin: 16, statut: "todo", demiJours: 6 },

    // --- Cas de figure volontairement représentés, pour que chaque écran ait
    // --- de quoi montrer son comportement en démonstration.

    // Hors projet : Task.projectId est facultatif (réunions, administratif).
    { projet: null, title: "Revue de presse hebdomadaire", studios: ["consultance"], qui: "driss", debut: -2, fin: 2, statut: "inProgress", demiJours: 2 },
    { projet: null, title: "Entretiens annuels", studios: ["consultance"], qui: null, debut: 10, fin: 24, statut: "todo", demiJours: 6 },

    // Sans estimation : la Charge compte alors toute la plage comme occupée.
    { projet: "digicit", title: "Veille sur les usages numériques des jeunes", studios: ["consultance"], qui: "elena", debut: -1, fin: 20, statut: "inProgress" },
    { projet: "climat", title: "Retouches après retour client", studios: ["graphisme"], qui: "amelie", debut: 1, fin: 3, statut: "todo" },

    // Durée maximale : borne l'étalement, distincte de l'estimation d'effort.
    { projet: "oxfam", title: "Validation juridique des images", studios: ["consultance"], qui: "driss", debut: 4, fin: 11, statut: "todo", demiJours: 2, maxJours: 5 },
    { projet: "parentalite", title: "Mixage final", studios: ["son"], qui: "chloe", debut: 14, fin: 18, statut: "todo", demiJours: 4, maxJours: 3 },

    // À la corbeille : Réglages → Corbeille était vide.
    { projet: "vitrine", title: "Bannière animée (abandonnée)", studios: ["graphisme"], qui: "amelie", debut: -25, fin: -18, statut: "todo", demiJours: 3, corbeille: 9 },
    { projet: "oxfam", title: "Version longue du spot (annulée)", studios: ["video"], qui: "chloe", debut: -14, fin: -7, statut: "todo", demiJours: 5, corbeille: 3 },

    // Trois studios sur une même tâche, et un titre volontairement long pour
    // éprouver la troncature des colonnes.
    { projet: "ep2026", title: "Journée de lancement — captation, sonorisation et supports imprimés pour l’ensemble des ateliers", studios: ["video", "son", "graphisme"], qui: "chloe", debut: 16, fin: 17, statut: "todo", demiJours: 4 },

    // Studio Son, sous-représenté jusqu'ici.
    { projet: "digicit", title: "Nettoyage des prises de son", studios: ["son"], qui: "chloe", debut: -9, fin: -5, statut: "delivered", demiJours: 3 },
    { projet: "parentalite", title: "Génériques et jingles", studios: ["son"], qui: "chloe", debut: 5, fin: 9, statut: "todo", demiJours: 3, sousTaches: [["Générique d’ouverture", 6, false], ["Virgules sonores", 8, false], ["Générique de fin", 9, false]] },

    // Tâche longue, pour que le Gantt ait une barre qui traverse la fenêtre.
    { projet: "ep2026", title: "Accompagnement des groupes locaux", studios: ["consultance"], qui: "driss", debut: -30, fin: 60, statut: "inProgress", demiJours: 30 },

    // Tâche d'une seule journée, à l'opposé.
    { projet: "mediaEduc", title: "Comité de lecture", studios: ["consultance"], qui: "elena", debut: 6, fin: 6, statut: "todo", demiJours: 1 },

    // Sous-tâches partiellement faites, pour un avancement intermédiaire.
    { projet: "vitrine", title: "Accessibilité et tests", description: "Passe AA sur l’ensemble du site : contrastes, navigation au clavier, lecteurs d’écran. Les trois sous-tâches suivent chacun de ces axes.", studios: ["web"], qui: "bilal", debut: 2, fin: 12, statut: "todo", demiJours: 6, sousTaches: [["Contrastes", 4, true], ["Navigation clavier", 7, false], ["Lecteurs d’écran", 11, false]] },
  ];

  const tachesParTitre: Record<string, string> = {};
  for (const t of TACHES) {
    const row = await db.task.create({
      data: {
        title: t.title,
        description: t.description ?? null,
        projectId: t.projet ? projets[t.projet] : null,
        studios: { create: t.studios.map((s) => ({ studioId: studios[s] })) },
        assigneeId: t.qui ? people[t.qui] : null,
        startDate: new Date(addDaysIso(auj, t.debut)),
        endDate: new Date(addDaysIso(auj, t.fin)),
        estimatedHalfDays: t.demiJours ?? null,
        maxDurationDays: t.maxJours ?? null,
        trashedAt: t.corbeille != null ? new Date(addDaysIso(auj, -t.corbeille)) : null,
        statusId: statuses[t.statut],
        subtasks: t.sousTaches
          ? { create: t.sousTaches.map(([title, jours, done], i) => ({ title, dueDate: new Date(addDaysIso(auj, jours)), done, position: i })) }
          : undefined,
      },
    });
    tachesParTitre[t.title] = row.id;
  }

  // Une dépendance et une récurrence, pour que le Gantt affiche un lien et que
  // la fiche de tâche montre ces champs remplis.
  await db.task.update({
    where: { id: tachesParTitre["Montage et étalonnage"] },
    data: { dependsOnId: tachesParTitre["Tournage sur site"] },
  });
  await db.task.update({
    where: { id: tachesParTitre["Sous-titrage multilingue"] },
    data: { dependsOnId: tachesParTitre["Tournage capsules 1 à 4"] },
  });
  await db.task.create({
    data: {
      title: "Réunion d’équipe hebdomadaire",
      projectId: projets.intranet,
      studios: { create: [{ studioId: studios.consultance }] },
      assigneeId: people.elena,
      startDate: new Date(addDaysIso(auj, 1)),
      endDate: new Date(addDaysIso(auj, 1)),
      statusId: statuses.todo,
      estimatedHalfDays: 1,
      recurrenceFrequency: "WEEKLY",
      recurrenceInterval: 1,
    },
  });
  await db.task.create({
    data: {
      title: "Point quotidien du studio Web",
      projectId: projets.intranet,
      studios: { create: [{ studioId: studios.web }] },
      assigneeId: people.bilal,
      startDate: new Date(auj),
      endDate: new Date(auj),
      statusId: statuses.todo,
      estimatedHalfDays: 1,
      recurrenceFrequency: "DAILY",
      recurrenceInterval: 1,
    },
  });
  await db.task.create({
    data: {
      title: "Facturation du mois",
      studios: { create: [{ studioId: studios.consultance }] },
      assigneeId: people.elena,
      startDate: new Date(addDaysIso(auj, 12)),
      endDate: new Date(addDaysIso(auj, 12)),
      statusId: statuses.todo,
      estimatedHalfDays: 1,
      recurrenceFrequency: "MONTHLY",
      recurrenceInterval: 1,
      recurrenceMonthlyMode: "BY_DATE",
    },
  });
  await db.task.create({
    data: {
      title: "Comité de pilotage EP",
      projectId: projets.ep2026,
      studios: { create: [{ studioId: studios.consultance }] },
      assigneeId: people.elena,
      startDate: new Date(addDaysIso(auj, 5)),
      endDate: new Date(addDaysIso(auj, 5)),
      statusId: statuses.todo,
      estimatedHalfDays: 1,
      recurrenceFrequency: "MONTHLY",
      recurrenceInterval: 1,
      recurrenceMonthlyMode: "BY_WEEKDAY",
    },
  });

  // Quelles tâches appartiennent à quel projet — sert à rattacher la plupart
  // des écritures à une tâche précise plutôt qu'au projet en bloc.
  const tachesParProjet: Record<string, string[]> = {};
  for (const t of TACHES) {
    // Les tâches hors projet et celles à la corbeille ne reçoivent pas
    // d'écritures : les premières n'ont pas de projet où les rattacher, les
    // secondes ne doivent pas peser dans les budgets.
    if (!t.projet || t.corbeille != null) continue;
    (tachesParProjet[t.projet] ??= []).push(tachesParTitre[t.title]);
  }

  console.log("Semis des écritures de temps (12 mois)…");
  // Réparties sur douze mois pour que l'historique du Tableau de bord ait une
  // vraie courbe, et calibrées pour qu'un projet dépasse son budget (Campagne
  // de sensibilisation) pendant qu'un autre reste largement dedans.
  const PROFILS: { qui: string; studios: string[]; projets: string[]; parMois: number }[] = [
    { qui: "amelie", studios: ["graphisme"], projets: ["vitrine", "climat", "mediaEduc"], parMois: 16 },
    { qui: "bilal", studios: ["web"], projets: ["vitrine", "ep2026", "intranet"], parMois: 18 },
    { qui: "chloe", studios: ["video", "son"], projets: ["oxfam", "digicit", "parentalite"], parMois: 20 },
    { qui: "driss", studios: ["consultance"], projets: ["mediaEduc", "oxfam", "ep2026"], parMois: 14 },
    { qui: "elena", studios: ["consultance", "web"], projets: ["digicit", "ep2026"], parMois: 8 },
  ];

  const categoriesParStudio = await db.taskCategory.findMany({ select: { id: true, studioId: true } });
  const ecritures: {
    personId: string; projectId: string; taskId: string | null; studioId: string; categoryId: string | null;
    startedAt: Date; endedAt: Date; note: string | null;
  }[] = [];

  const maintenant = new Date(auj);
  for (let recul = 11; recul >= 0; recul--) {
    const mois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - recul, 1));
    const joursDuMois = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 0)).getUTCDate();
    for (const profil of PROFILS) {
      for (let i = 0; i < profil.parMois; i++) {
        const jour = entre(1, joursDuMois);
        const debut = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth(), jour, entre(8, 15), parmi([0, 15, 30, 45])));
        // Le mois courant ne se remplit que jusqu'à aujourd'hui : des heures
        // pointées dans le futur fausseraient tous les totaux.
        if (debut > new Date(auj)) continue;
        const minutes = parmi([45, 60, 90, 120, 150, 180, 240]);
        const studioSlug = parmi(profil.studios);
        const studioId = studios[studioSlug];
        const candidates = categoriesParStudio.filter((c) => c.studioId === studioId || c.studioId === null);
        const cleProjet = parmi(profil.projets);
        // Environ trois écritures sur quatre se rattachent à une tâche précise,
        // le reste au projet seul (réunions, coordination, suivi). Tout
        // rattacher au projet rendait la ventilation par tâche inutile —
        // 100 % « hors tâche » — et ne ressemblait pas à un vrai relevé.
        const tachesDuProjet = tachesParProjet[cleProjet] ?? [];
        const taskId = tachesDuProjet.length > 0 && alea() < 0.75 ? parmi(tachesDuProjet) : null;
        ecritures.push({
          personId: people[profil.qui],
          projectId: projets[cleProjet],
          taskId,
          studioId,
          categoryId: candidates.length ? parmi(candidates).id : null,
          startedAt: debut,
          endedAt: new Date(debut.getTime() + minutes * 60_000),
          note: null,
        });
      }
    }
  }
  await db.timeEntry.createMany({ data: ecritures });
  console.log(`  ${ecritures.length} écritures.`);

  console.log("Semis des feuilles de temps…");
  // Les mois anciens sont validés, l'avant-dernier est remis et attend un
  // administrateur, le mois en cours reste ouvert : les trois états sont donc
  // visibles à l'écran sans rien manipuler.
  const moisCle = (recul: number) => {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - recul, 1));
    return d;
  };
  for (const profil of PROFILS) {
    for (let recul = 6; recul >= 2; recul--) {
      await db.timesheetPeriod.create({
        data: {
          personId: people[profil.qui],
          month: moisCle(recul),
          status: "APPROVED",
          submittedAt: new Date(moisCle(recul - 1).getTime() + 2 * 86_400_000),
          reviewedAt: new Date(moisCle(recul - 1).getTime() + 4 * 86_400_000),
          reviewedById: people.elena,
        },
      });
    }
  }
  for (const qui of ["amelie", "bilal", "chloe"]) {
    await db.timesheetPeriod.create({
      data: {
        personId: people[qui],
        month: moisCle(1),
        status: "SUBMITTED",
        submittedAt: new Date(moisCle(0).getTime() + 86_400_000),
      },
    });
  }

  console.log("Semis des absences, demandes et commentaires…");
  const ABSENCES = [
    { qui: "chloe", debut: 10, fin: 14, raison: "Congé" },
    { qui: "amelie", debut: -4, fin: -2, raison: "Formation" },
    { qui: "bilal", debut: 22, fin: 33, raison: "Congé" },
    { qui: "driss", debut: 2, fin: 3, raison: "Récupération" },
  ];
  for (const a of ABSENCES) {
    await db.absence.create({
      data: {
        personId: people[a.qui],
        startDate: new Date(addDaysIso(auj, a.debut)),
        endDate: new Date(addDaysIso(auj, a.fin)),
        reason: a.raison,
      },
    });
  }

  const DEMANDES = [
    { subject: "Bannière pour la newsletter de novembre", studio: "graphisme", jours: 12, par: "Service communication", detail: "Format 600×200, aux couleurs de la campagne climat." },
    { subject: "Capsule vidéo de 2 minutes pour l’AG", studio: "video", jours: 25, par: "Direction", detail: "Reprise d’images d’archive + interview de la présidente." },
    { subject: "Relecture du rapport d’activité", studio: "consultance", jours: 6, par: "Anonyme", detail: null },
  ];
  for (const d of DEMANDES) {
    await db.request.create({
      data: {
        subject: d.subject,
        studioId: studios[d.studio],
        wantedFor: new Date(addDaysIso(auj, d.jours)),
        detail: d.detail,
        createdBy: d.par,
      },
    });
  }

  const COMMENTAIRES: [string, string, string][] = [
    ["Intégration front", "bilal", "Les composants de base sont poussés, il reste les pages de contenu."],
    ["Intégration front", "elena", "Parfait. On cale une revue vendredi ?"],
    ["Tournage capsules 1 à 4", "chloe", "Deux capsules tournées, la météo a décalé les deux autres."],
    ["Maquettes des supports", "amelie", "Première version envoyée au client pour avis."],
  ];
  for (const [titre, qui, body] of COMMENTAIRES) {
    await db.comment.create({
      data: {
        taskId: tachesParTitre[titre],
        authorId: people[qui],
        authorName: PEOPLE.find((p) => p.key === qui)!.name,
        body,
      },
    });
  }

  await db.attachment.create({
    data: {
      taskId: tachesParTitre["Conception des modules"],
      name: "Trame des modules (SharePoint)",
      kind: "LINK",
      url: "https://example.org/trame-modules",
      uploadedById: people.driss,
    },
  });

  console.log("Semis des notifications…");
  // Adressées au compte administrateur réel plutôt qu'à une personne du semis :
  // c'est celui avec lequel on ouvre la démonstration, et une notification
  // qu'on ne voit pas ne démontre rien. On relit son `personId` au lieu de le
  // supposer — il diffère d'un environnement à l'autre.
  // `findFirst` sans `orderBy` laisse PostgreSQL choisir : avec deux comptes
  // administrateurs, les notifications atterrissaient au hasard sur l'un ou
  // sur l'autre — en ligne, elles étaient toutes allées au mauvais, et la
  // démonstration s'ouvrait sur une boîte vide. On nomme donc explicitement
  // le compte de démonstration, avec un repli déterministe.
  const compteDemo = await db.user.findFirst({
    where: { email: COMPTE_DEMO },
    select: { personId: true },
  });
  const premierAdmin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { personId: true },
    orderBy: { createdAt: "asc" },
  });
  const destinataire = compteDemo?.personId ?? premierAdmin?.personId ?? people.elena;

  const NOTIFICATIONS: { type: NotificationType; message: string; lien: string | null; lue: boolean; heures: number }[] = [
    {
      type: "MILESTONE_LATE",
      message: `6 jours de retard : « Livraison du pilote » — Commission européenne — DG CONNECT — DigiCitizen — capsules européennes.`,
      lien: `/projets/${projets.digicit}`,
      lue: false,
      heures: 2,
    },
    {
      type: "BUDGET_EXCEEDED",
      message: `« Refonte du site vitrine » : 268 h enregistrées sur 220 h prévues.`,
      lien: `/projets/${projets.vitrine}`,
      lue: false,
      heures: 5,
    },
    {
      type: "MENTION",
      message: `Bilal Haddouchi vous a mentionné·e sur « Intégration front ».`,
      lien: `/taches/${tachesParTitre["Intégration front"]}`,
      lue: false,
      heures: 20,
    },
    {
      type: "REQUEST",
      message: `« Bannière pour la newsletter de novembre » — Graphisme.`,
      lien: `/demandes`,
      lue: false,
      heures: 26,
    },
    {
      type: "PROJECT_BEHIND",
      message: `« Podcast parentalité » : 64 % du budget consommé pour 30 % d’avancement.`,
      lien: `/projets/${projets.parentalite}`,
      lue: true,
      heures: 50,
    },
    {
      type: "COMMENT",
      message: `Amélie Verstraeten a commenté « Maquettes des supports ».`,
      lien: `/taches/${tachesParTitre["Maquettes des supports"]}`,
      lue: true,
      heures: 74,
    },
    {
      type: "ASSIGNMENT",
      message: `« Comité de lecture » vous a été attribuée.`,
      lien: `/taches/${tachesParTitre["Comité de lecture"]}`,
      lue: true,
      heures: 96,
    },
    {
      type: "MENTION",
      message: `Chloé Dubois vous a mentionné·e sur « Montage et étalonnage » : « le premier étalonnage est prêt, tu veux le voir avant l\u2019export ? »`,
      lien: `/taches/${tachesParTitre["Montage et étalonnage"]}`,
      lue: false,
      heures: 8,
    },
    {
      type: "MILESTONE_LATE",
      message: `3 jours de retard : « Validation du visuel par le comité » — CNCD-11.11.11 — Mobilisation climat.`,
      lien: `/projets/${projets.climat}`,
      lue: false,
      heures: 11,
    },
    {
      type: "COMMENT",
      message: `Driss El Amrani a commenté « Accompagnement des groupes locaux » : « trois groupes ont décalé leur date, je réajuste. »`,
      lien: `/taches/${tachesParTitre["Accompagnement des groupes locaux"]}`,
      lue: false,
      heures: 15,
    },
    {
      type: "REQUEST",
      message: `« Captation vidéo de la conférence du 12 » — Vidéo, Son.`,
      lien: `/demandes`,
      lue: false,
      heures: 30,
    },
    {
      type: "ASSIGNMENT",
      message: `« Sous-titrage multilingue » vous a été attribuée.`,
      lien: `/taches/${tachesParTitre["Sous-titrage multilingue"]}`,
      lue: false,
      heures: 34,
    },
    {
      type: "BUDGET_EXCEEDED",
      message: `« Mobilisation climat » : 198 h enregistrées sur 160 h prévues.`,
      lien: `/projets/${projets.climat}`,
      lue: true,
      heures: 62,
    },
    {
      type: "MENTION",
      message: `Amélie Verstraeten vous a mentionné·e sur « Affiches et déclinaisons ».`,
      lien: `/taches/${tachesParTitre["Affiches et déclinaisons"]}`,
      lue: true,
      heures: 80,
    },
    {
      type: "COMMENT",
      message: `Bilal Haddouchi a commenté « Accessibilité et tests » : « il reste deux régressions sur le formulaire d\u2019inscription. »`,
      lien: `/taches/${tachesParTitre["Accessibilité et tests"]}`,
      lue: true,
      heures: 104,
    },
    {
      type: "PROJECT_BEHIND",
      message: `« Intranet — refonte » : 71 % du budget consommé pour 25 % d\u2019avancement.`,
      lien: `/projets/${projets.intranet}`,
      lue: true,
      heures: 130,
    },
    {
      type: "REQUEST",
      message: `Demande acceptée : « Habillage sonore du podcast » — confiée au studio Son.`,
      lien: `/demandes`,
      lue: true,
      heures: 158,
    },
    {
      type: "ASSIGNMENT",
      message: `« Validation juridique des images » vous a été attribuée.`,
      lien: `/taches/${tachesParTitre["Validation juridique des images"]}`,
      lue: true,
      heures: 186,
    },
  ];

  // Un titre mal orthographié donnait silencieusement « /taches/undefined » —
  // un lien mort dans la démonstration, invisible tant qu'on ne clique pas.
  const liensMorts = NOTIFICATIONS.filter((n) => n.lien?.includes("undefined")).map((n) => n.message);
  if (liensMorts.length > 0) {
    throw new Error(`Notifications pointant vers un identifiant inconnu :\n- ${liensMorts.join("\n- ")}`);
  }

  for (const n of NOTIFICATIONS) {
    await db.notification.create({
      data: {
        recipientId: destinataire,
        type: n.type,
        message: n.message,
        link: n.lien,
        read: n.lue,
        createdAt: new Date(Date.now() - n.heures * 3_600_000),
      },
    });
  }

  console.log(
    `Terminé. ${PROJETS.length} projets, ${TACHES.length + 4} tâches, ${ecritures.length} écritures de temps, ${NOTIFICATIONS.length} notifications.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
