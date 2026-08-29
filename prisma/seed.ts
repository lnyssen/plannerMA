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

const STUDIOS = [
  { slug: "graphisme", name: "Graphisme", colorHex: "#0B7C6B", initial: "G" },
  { slug: "web", name: "Web", colorHex: "#B5530C", initial: "W" },
  { slug: "video", name: "Vidéo", colorHex: "#B0264B", initial: "V" },
  { slug: "son", name: "Son", colorHex: "#7A6200", initial: "S" },
  { slug: "consultance", name: "Consultance", colorHex: "#1D5FA3", initial: "C" },
];

async function main() {
  // Projets/tâches/absences ne sont pas des données nominatives réelles :
  // on repart de zéro à chaque semis plutôt que d'accumuler des doublons à
  // chaque exécution. Studios, personnes et comptes restent stables (upsert
  // par clé naturelle) puisqu'on veut pouvoir re-semer sans casser les liens
  // déjà créés en développement.
  console.log("Nettoyage des données de démonstration précédentes…");
  await db.comment.deleteMany();
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
      update: {},
      create: { ...s, position: i },
    });
    studios[s.slug] = studio.id;
  }

  console.log("Semis de l'équipe…");
  const people: Record<string, string> = {};
  const PEOPLE = [
    { key: "amelie", name: "Amélie Verstraeten", studioSlugs: ["graphisme"] },
    { key: "bilal", name: "Bilal Haddouchi", studioSlugs: ["web"] },
    { key: "chloe", name: "Chloé Dubois", studioSlugs: ["video", "son"] },
    { key: "driss", name: "Driss El Amrani", studioSlugs: ["consultance"] },
    { key: "elena", name: "Eléna Petit", studioSlugs: ["graphisme", "web"], team: "Direction" },
  ];
  for (const p of PEOPLE) {
    const person = await db.person.upsert({
      where: { id: p.key }, // clé arbitraire stable pour le seed uniquement
      update: {},
      create: {
        id: p.key,
        name: p.name,
        team: p.team ?? "Studios",
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

  console.log("Semis des projets et tâches…");
  const auj = today();

  const projetInterne = await db.project.create({
    data: {
      name: "Refonte du site vitrine",
      client: "Média Animation — communication interne",
      type: "INTERNAL",
      studios: { create: [{ studioId: studios.web }, { studioId: studios.graphisme }] },
      tasks: {
        create: [
          {
            title: "Arborescence et wireframes",
            studioId: studios.web,
            assigneeId: people.bilal,
            startDate: new Date(auj),
            endDate: new Date(addDaysIso(auj, 4)),
            status: "IN_PROGRESS",
            subtasks: {
              create: [
                { title: "Page d'accueil", dueDate: new Date(addDaysIso(auj, 2)), done: true },
                { title: "Pages studios", dueDate: new Date(addDaysIso(auj, 4)), done: false },
              ],
            },
          },
          {
            title: "Charte graphique déclinée au site",
            studioId: studios.graphisme,
            assigneeId: people.amelie,
            startDate: new Date(addDaysIso(auj, 2)),
            endDate: new Date(addDaysIso(auj, 8)),
            status: "TODO",
          },
        ],
      },
    },
  });

  await db.project.create({
    data: {
      name: "Campagne de sensibilisation",
      client: "Oxfam Belgique",
      type: "EXTERNAL",
      studios: { create: [{ studioId: studios.video }, { studioId: studios.consultance }] },
      tasks: {
        create: [
          {
            title: "Tournage sur site",
            studioId: studios.video,
            assigneeId: people.chloe,
            startDate: new Date(addDaysIso(auj, 5)),
            endDate: new Date(addDaysIso(auj, 6)),
            status: "TODO",
          },
          {
            title: "Cadrage stratégique avec le client",
            studioId: studios.consultance,
            assigneeId: people.driss,
            startDate: new Date(auj),
            endDate: new Date(auj),
            status: "VALIDATION",
            validationRounds: 1,
          },
        ],
      },
    },
  });

  console.log("Semis d'une absence…");
  await db.absence.create({
    data: {
      personId: people.chloe,
      startDate: new Date(addDaysIso(auj, 10)),
      endDate: new Date(addDaysIso(auj, 14)),
      reason: "Congé",
    },
  });

  console.log(`Terminé. Projet interne : ${projetInterne.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
