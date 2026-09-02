// Jeu de données de démonstration : les cinq studios de Média Animation, une
// poignée de personnes, deux projets (un interne, un externe) avec quelques
// tâches et sous-tâches, une absence et un compte administrateur.
//
// `npm run db:seed` (ou automatiquement après `prisma migrate dev`).

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
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

async function main() {
  // Projets/tâches/absences ne sont pas des données nominatives réelles :
  // on repart de zéro à chaque semis plutôt que d'accumuler des doublons à
  // chaque exécution. Studios, personnes et comptes restent stables (upsert
  // par clé naturelle) puisqu'on veut pouvoir re-semer sans casser les liens
  // déjà créés en développement.
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

  console.log("Semis du compte administrateur (admin@media-animation.be / changez-moi)…");
  await db.user.upsert({
    where: { email: "admin@media-animation.be" },
    update: {},
    create: {
      email: "admin@media-animation.be",
      passwordHash: await bcrypt.hash("changez-moi", 12),
      role: "ADMIN",
      personId: people.elena,
    },
  });

  console.log("Semis d'un compte collaborateur (bilal@media-animation.be / changez-moi)…");
  await db.user.upsert({
    where: { email: "bilal@media-animation.be" },
    update: {},
    create: {
      email: "bilal@media-animation.be",
      passwordHash: await bcrypt.hash("changez-moi", 12),
      role: "COLLABORATOR",
      personId: people.bilal,
    },
  });

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
    const row = await db.client.upsert({ where: { name: c.name }, update: {}, create: { name: c.name } });
    clients[c.name] = row.id;
  }

  // Budgets calibrés pour que chaque état du Tableau de bord soit visible sur
  // au moins un projet : dans les temps, en avance, en retard de consommation,
  // et franchement dépassé.
  const PROJETS = [
    { key: "vitrine", name: "Refonte du site vitrine", code: "SITE-1", client: CLIENTS[0].name, type: "INTERNAL" as const, projectType: "FONCTIONNEMENT" as const, budget: 220, studios: ["web", "graphisme"] },
    { key: "oxfam", name: "Campagne de sensibilisation", code: "OXFAM-2", client: CLIENTS[1].name, type: "EXTERNAL" as const, projectType: "EXTERNE" as const, budget: 180, studios: ["video", "consultance"] },
    { key: "mediaEduc", name: "Parcours d’éducation aux médias", code: "FWB-EDUC", client: CLIENTS[2].name, type: "EXTERNAL" as const, projectType: "EQUIPE_EDUCATIVE" as const, budget: 320, studios: ["consultance", "graphisme"] },
    { key: "digicit", name: "DigiCitizen — capsules européennes", code: "EU-DIGI", client: CLIENTS[3].name, type: "EXTERNAL" as const, projectType: "EUROPEEN" as const, budget: 400, studios: ["video", "son", "web"] },
    { key: "climat", name: "Mobilisation climat", code: "CNCD-CLIM", client: CLIENTS[4].name, type: "EXTERNAL" as const, projectType: "EXTERNE" as const, budget: 120, studios: ["graphisme"] },
    { key: "parentalite", name: "Podcast parentalité", code: "LDF-POD", client: CLIENTS[5].name, type: "EXTERNAL" as const, projectType: "EP" as const, budget: 150, studios: ["son", "consultance"] },
    { key: "ep2026", name: "Éducation permanente 2026", code: "EP-2026", client: CLIENTS[0].name, type: "INTERNAL" as const, projectType: "EP" as const, budget: 500, studios: ["consultance", "web", "video"] },
    { key: "intranet", name: "Intranet — refonte", code: null, client: CLIENTS[0].name, type: "INTERNAL" as const, projectType: "FONCTIONNEMENT" as const, budget: null, studios: ["web"] },
    { key: "archive", name: "Expo itinérante 2025", code: "EXPO-25", client: CLIENTS[2].name, type: "EXTERNAL" as const, projectType: "EXTERNE" as const, budget: 90, studios: ["graphisme", "video"], archived: true },
  ];

  const projets: Record<string, string> = {};
  for (const p of PROJETS) {
    const row = await db.project.create({
      data: {
        name: p.name,
        code: p.code,
        clientId: clients[p.client],
        type: p.type,
        projectType: p.projectType,
        budgetHours: p.budget,
        archived: p.archived ?? false,
        studios: { create: p.studios.map((s) => ({ studioId: studios[s] })) },
      },
    });
    projets[p.key] = row.id;
  }

  // Jalons : quelques-uns dépassés (le Tableau de bord les remonte en rouge),
  // d'autres à venir dans les trente jours, d'autres déjà faits.
  const JALONS = [
    { projet: "digicit", title: "Livraison du pilote", jours: -6, fait: false },
    { projet: "mediaEduc", title: "Validation du parcours par la FWB", jours: 9, fait: false },
    { projet: "oxfam", title: "Diffusion de la campagne", jours: 21, fait: false },
    { projet: "ep2026", title: "Dépôt du dossier EP", jours: 44, fait: false },
    { projet: "vitrine", title: "Recette technique", jours: -20, fait: true },
    { projet: "climat", title: "Bon à tirer affiches", jours: 4, fait: false },
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
    projet: string;
    title: string;
    studios: string[];
    qui: string | null;
    debut: number;
    fin: number;
    statut: keyof typeof statuses;
    demiJours?: number;
    sousTaches?: [string, number, boolean][];
  }[] = [
    { projet: "vitrine", title: "Arborescence et wireframes", studios: ["web"], qui: "bilal", debut: -34, fin: -22, statut: "delivered", demiJours: 8, sousTaches: [["Page d’accueil", -30, true], ["Pages studios", -24, true]] },
    { projet: "vitrine", title: "Charte graphique déclinée au site", studios: ["graphisme"], qui: "amelie", debut: -20, fin: -6, statut: "delivered", demiJours: 10 },
    { projet: "vitrine", title: "Intégration front", studios: ["web"], qui: "bilal", debut: -5, fin: 6, statut: "inProgress", demiJours: 12, sousTaches: [["Composants de base", 1, true], ["Pages de contenu", 5, false]] },
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
    { projet: "digicit", title: "Écriture des capsules", studios: ["video", "consultance"], qui: "chloe", debut: -30, fin: -12, statut: "delivered", demiJours: 16 },
    { projet: "digicit", title: "Tournage capsules 1 à 4", studios: ["video"], qui: "chloe", debut: -11, fin: -4, statut: "inProgress", demiJours: 12 },
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
  ];

  const tachesParTitre: Record<string, string> = {};
  for (const t of TACHES) {
    const row = await db.task.create({
      data: {
        title: t.title,
        projectId: projets[t.projet],
        studios: { create: t.studios.map((s) => ({ studioId: studios[s] })) },
        assigneeId: t.qui ? people[t.qui] : null,
        startDate: new Date(addDaysIso(auj, t.debut)),
        endDate: new Date(addDaysIso(auj, t.fin)),
        estimatedHalfDays: t.demiJours ?? null,
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
    personId: string; projectId: string; studioId: string; categoryId: string | null;
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
        ecritures.push({
          personId: people[profil.qui],
          projectId: projets[parmi(profil.projets)],
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

  console.log(
    `Terminé. ${PROJETS.length} projets, ${TACHES.length + 2} tâches, ${ecritures.length} écritures de temps.`,
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
