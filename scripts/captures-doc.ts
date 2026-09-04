/**
 * Régénère les captures de la page d'aide (public/docs/*.png).
 *
 * Elles étaient prises à la main, ce qui revenait à les laisser vieillir :
 * chaque retouche d'interface les périmait en silence, et personne ne
 * refaisait dix-sept images. Ici un `npm run docs:captures` suffit.
 *
 * La session est ouverte en forgeant directement le jeton Auth.js plutôt
 * qu'en remplissant le formulaire de connexion : aucun mot de passe ne
 * transite, et le script ne dépend pas du balisage de l'écran de connexion.
 *
 * Prérequis : le serveur de développement tourne (npm run dev) et la base
 * contient le jeu de démonstration (npm run db:seed).
 */
import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { encode } from "@auth/core/jwt";
import { chromium, type Page } from "playwright";
import { db } from "../src/lib/db";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const SORTIE = path.join(process.cwd(), "public", "docs");
const LARGEUR = 1440;
const HAUTEUR = 900;

/**
 * Le serveur de développement pose un témoin flottant (le rond « N » en bas
 * à gauche) qui n'existe pas en production et n'a rien à faire dans la
 * documentation.
 */
const MASQUE_TEMOIN_DEV = "nextjs-portal, [data-nextjs-toast], #next-logo { display: none !important; }";

/** Laisse le temps aux polices, aux images et aux animations d'entrée. */
async function poser(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

type Capture = { nom: string; url: string; avant?: (page: Page) => Promise<void> };

async function main() {
  const utilisateur = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true, role: true, personId: true, person: { select: { name: true } } },
  });
  if (!utilisateur) throw new Error("Aucun compte administrateur — lancez d'abord npm run db:seed.");

  // Une tâche rattachée à un projet, décrite et commentée montre la fiche
  // pleine plutôt qu'un formulaire vide.
  const tache =
    (await db.task.findFirst({
      where: { trashedAt: null, projectId: { not: null }, description: { not: null }, comments: { some: {} } },
      orderBy: { startDate: "asc" },
      select: { id: true },
    })) ??
    (await db.task.findFirst({
      where: { trashedAt: null, projectId: { not: null }, description: { not: null } },
      orderBy: { startDate: "asc" },
      select: { id: true },
    })) ??
    (await db.task.findFirst({
      where: { trashedAt: null, projectId: { not: null } },
      orderBy: { startDate: "asc" },
      select: { id: true },
    }));
  if (!tache) throw new Error("Aucune tâche à montrer sur la capture de fiche.");

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET absent de l'environnement.");

  const salt = "authjs.session-token";
  const jeton = await encode({
    token: {
      sub: utilisateur.id,
      email: utilisateur.email,
      name: utilisateur.person?.name ?? utilisateur.email,
      role: utilisateur.role,
      personId: utilisateur.personId,
    },
    secret,
    salt,
    maxAge: 60 * 60,
  });

  const CAPTURES: Capture[] = [
    { nom: "aujourdhui", url: "/aujourdhui" },
    { nom: "tableau-de-bord", url: "/tableau-de-bord" },
    { nom: "projets", url: "/projets" },
    { nom: "clients", url: "/clients" },
    { nom: "taches", url: "/taches" },
    { nom: "fiche-tache", url: `/taches/${tache.id}` },
    { nom: "planning-gantt", url: "/planning?vue=gantt" },
    { nom: "planning-kanban", url: "/planning?vue=kanban" },
    { nom: "planning-semaine", url: "/planning?vue=semaine" },
    { nom: "temps", url: "/temps" },
    { nom: "charge", url: "/charge" },
    { nom: "subventions", url: "/subventions" },
    { nom: "demandes", url: "/demandes" },
    { nom: "equipe", url: "/equipe" },
    { nom: "reglages", url: "/reglages" },
    {
      nom: "notifications",
      url: "/projets",
      avant: async (page) => {
        await page.locator('[aria-label="Notifications"]').first().click();
        await page.waitForTimeout(500);
      },
    },
    {
      // La recherche et la palette sont le même écran : vide, il propose des
      // actions ; rempli, il cherche. Une capture pour chaque état.
      nom: "recherche",
      url: "/projets",
      avant: async (page) => {
        await page.keyboard.press("Meta+k");
        await page.locator('[aria-label="Palette de commandes"] input').waitFor();
        await page.keyboard.type("capsule", { delay: 40 });
        await page.waitForTimeout(1200);
      },
    },
    {
      nom: "palette",
      url: "/projets",
      avant: async (page) => {
        await page.keyboard.press("Meta+k");
        await page.locator('[aria-label="Palette de commandes"] input').waitFor();
        await page.waitForTimeout(600);
      },
    },
  ];

  await mkdir(SORTIE, { recursive: true });

  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({
    viewport: { width: LARGEUR, height: HAUTEUR },
    deviceScaleFactor: 2,
    locale: "fr-BE",
    timezoneId: "Europe/Brussels",
  });
  await contexte.addCookies([
    { name: salt, value: jeton, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);

  const page = await contexte.newPage();
  await page.addStyleTag({ content: MASQUE_TEMOIN_DEV }).catch(() => {});
  for (const c of CAPTURES) {
    await page.goto(`${BASE}${c.url}`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: MASQUE_TEMOIN_DEV }).catch(() => {});
    await poser(page);
    if (c.avant) {
      await c.avant(page);
      await poser(page);
    }
    const fichier = path.join(SORTIE, `${c.nom}.png`);
    await page.screenshot({ path: fichier });
    console.log(`✓ ${c.nom}.png`);
  }

  await navigateur.close();
  await db.$disconnect();
  console.log(`${CAPTURES.length} captures écrites dans public/docs/.`);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
