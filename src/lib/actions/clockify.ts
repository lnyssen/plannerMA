"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clockify, ClockifyError, clockifyConfig } from "@/lib/clockify/client";
import { clockifyProjectName, decideImport, monthKeyOfIso, monthRange } from "@/lib/clockify/mapping";
import { currentActorName } from "./actor";
import { timesheetLockFor } from "./timesheets";

async function requireAdminConfig() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." } as const;
  const config = clockifyConfig();
  if (!config) {
    return {
      error:
        "Clockify n’est pas configuré : renseignez CLOCKIFY_API_KEY et CLOCKIFY_WORKSPACE_ID côté serveur (voir .env.example).",
    } as const;
  }
  return { session, config } as const;
}

function readableError(e: unknown): string {
  if (e instanceof ClockifyError) {
    if (e.status === 401 || e.status === 403) return "Clockify refuse la clé d’API (401/403) — vérifiez CLOCKIFY_API_KEY.";
    if (e.status === 404) return "Espace de travail introuvable (404) — vérifiez CLOCKIFY_WORKSPACE_ID.";
    return `Clockify a répondu ${e.status}. ${e.body}`;
  }
  return e instanceof Error ? e.message : "Erreur inconnue.";
}

/** État de l'intégration, pour l'écran Réglages. */
export async function getClockifyStatus() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return null;
  const config = clockifyConfig();

  const [people, projects] = await Promise.all([
    db.person.count({ where: { active: true } }),
    db.project.count({ where: { archived: false } }),
  ]);
  const [linkedPeople, linkedProjects, importedEntries] = await Promise.all([
    db.person.count({ where: { active: true, clockifyUserId: { not: null } } }),
    db.project.count({ where: { archived: false, clockifyId: { not: null } } }),
    db.timeEntry.count({ where: { clockifyId: { not: null } } }),
  ]);

  if (!config) {
    return { configured: false as const, people, linkedPeople, projects, linkedProjects, importedEntries };
  }

  try {
    const users = await clockify.listUsers(config);
    return {
      configured: true as const,
      reachable: true as const,
      workspaceUsers: users.length,
      people,
      linkedPeople,
      projects,
      linkedProjects,
      importedEntries,
    };
  } catch (e) {
    return {
      configured: true as const,
      reachable: false as const,
      error: readableError(e),
      people,
      linkedPeople,
      projects,
      linkedProjects,
      importedEntries,
    };
  }
}

export type ClockifyStatus = NonNullable<Awaited<ReturnType<typeof getClockifyStatus>>>;

/**
 * Relie les personnes du planner aux comptes Clockify, par adresse courriel.
 *
 * Le rapprochement par nom serait fragile (accents, prénom d'usage, ordre) ;
 * l'adresse est la seule donnée stable des deux côtés. Les personnes sans
 * correspondance sont listées plutôt que devinées : c'est ce qui bloquera
 * l'import de leurs heures, autant le dire tout de suite.
 */
export async function linkClockifyPeople(): Promise<{ error?: string; linked?: number; unmatched?: string[] }> {
  const guard = await requireAdminConfig();
  if ("error" in guard) return { error: guard.error };

  try {
    const users = await clockify.listUsers(guard.config);
    const byEmail = new Map(users.map((u) => [u.email.trim().toLowerCase(), u]));
    const people = await db.person.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true, user: { select: { email: true } } },
    });

    let linked = 0;
    const unmatched: string[] = [];
    for (const person of people) {
      const email = (person.user?.email ?? person.email)?.trim().toLowerCase();
      const match = email ? byEmail.get(email) : undefined;
      if (!match) {
        unmatched.push(person.name);
        continue;
      }
      await db.person.update({ where: { id: person.id }, data: { clockifyUserId: match.id } });
      linked++;
    }

    revalidatePath("/reglages");
    return { linked, unmatched };
  } catch (e) {
    return { error: readableError(e) };
  }
}

/**
 * Pousse clients et projets actifs vers Clockify.
 *
 * Sens descendant seulement : le planner est la source du référentiel, pour
 * que l'équipe pointe sur les bons projets. Rien n'est supprimé là-bas — un
 * projet archivé ici est archivé, pas effacé, sinon les heures déjà pointées
 * dessus disparaîtraient avec lui.
 */
export async function pushClockifyReferential(): Promise<{
  error?: string;
  clientsCreated?: number;
  projectsCreated?: number;
  projectsUpdated?: number;
}> {
  const guard = await requireAdminConfig();
  if ("error" in guard) return { error: guard.error };

  try {
    // On relit l'existant côté Clockify pour rattacher par nom ce qui a été
    // créé à la main là-bas avant cette intégration, plutôt que de créer un
    // doublon à côté.
    const [remoteClients, remoteProjects] = await Promise.all([
      clockify.listClients(guard.config),
      clockify.listProjects(guard.config),
    ]);
    const remoteClientByName = new Map(remoteClients.map((c) => [c.name.trim().toLowerCase(), c]));
    const remoteProjectByName = new Map(remoteProjects.map((p) => [p.name.trim().toLowerCase(), p]));

    let clientsCreated = 0;
    const clients = await db.client.findMany({ select: { id: true, name: true, clockifyId: true } });
    for (const client of clients) {
      if (client.clockifyId) continue;
      const existing = remoteClientByName.get(client.name.trim().toLowerCase());
      const remote = existing ?? (await clockify.createClient(guard.config, client.name));
      if (!existing) clientsCreated++;
      await db.client.update({ where: { id: client.id }, data: { clockifyId: remote.id } });
    }

    let projectsCreated = 0;
    let projectsUpdated = 0;
    const projects = await db.project.findMany({
      where: { archived: false },
      select: { id: true, name: true, code: true, clockifyId: true, client: { select: { clockifyId: true } } },
    });
    for (const project of projects) {
      const name = clockifyProjectName(project);
      if (project.clockifyId) {
        await clockify.updateProject(guard.config, project.clockifyId, { name });
        projectsUpdated++;
        continue;
      }
      const existing = remoteProjectByName.get(name.trim().toLowerCase());
      const remote =
        existing ?? (await clockify.createProject(guard.config, { name, clientId: project.client.clockifyId }));
      if (!existing) projectsCreated++;
      await db.project.update({ where: { id: project.id }, data: { clockifyId: remote.id } });
    }

    await db.journalEntry.create({
      data: {
        actorId: guard.session.user.personId,
        actorName: await currentActorName(guard.session),
        action: `Référentiel envoyé vers Clockify (${clientsCreated} client(s), ${projectsCreated} projet(s) créés)`,
      },
    });

    revalidatePath("/reglages");
    return { clientsCreated, projectsCreated, projectsUpdated };
  } catch (e) {
    return { error: readableError(e) };
  }
}

const importSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Mois invalide.") });

export interface ImportReport {
  imported: number;
  skipped: { reason: string; count: number }[];
  peopleWithoutAccount: string[];
}

/**
 * Importe les heures pointées dans Clockify pour un mois donné.
 *
 * Sens montant seulement : Clockify reste l'endroit où l'équipe pointe, le
 * planner récupère les heures pour alimenter budgets, Charge et feuilles de
 * temps. Rien n'est renvoyé dans l'autre sens, donc aucune règle de conflit à
 * arbitrer.
 *
 * Le verrou de feuille de temps s'applique aussi ici : une écriture qui
 * tomberait dans un mois déjà remis ou validé est écartée et comptée dans le
 * rapport. Sans ça, un import aurait modifié après coup des chiffres censés
 * être figés — et le verrou n'aurait plus rien prouvé.
 */
export async function importClockifyMonth(input: z.infer<typeof importSchema>): Promise<
  { error?: string } & Partial<ImportReport>
> {
  const guard = await requireAdminConfig();
  if ("error" in guard) return { error: guard.error };
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { month } = parsed.data;

  try {
    const range = monthRange(month);
    const [people, projects] = await Promise.all([
      db.person.findMany({
        where: { active: true },
        select: { id: true, name: true, clockifyUserId: true },
      }),
      db.project.findMany({
        where: { clockifyId: { not: null } },
        select: { id: true, clockifyId: true, studios: { select: { studioId: true } } },
      }),
    ]);

    const projectByClockifyId = new Map(projects.map((p) => [p.clockifyId!, p.id]));
    const studioByProjectId = new Map(projects.map((p) => [p.id, p.studios[0]?.studioId ?? null]));

    const report: ImportReport = { imported: 0, skipped: [], peopleWithoutAccount: [] };
    const skipped = new Map<string, number>();
    const note = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);

    for (const person of people) {
      if (!person.clockifyUserId) {
        report.peopleWithoutAccount.push(person.name);
        continue;
      }

      const locked = await timesheetLockFor(person.id, new Date(range.start));
      if (locked) {
        note(`feuille de ${person.name} déjà remise ou validée`);
        continue;
      }

      for (let page = 1; page <= 20; page++) {
        const entries = await clockify.listUserTimeEntries(guard.config, person.clockifyUserId, range, page);
        if (entries.length === 0) break;

        const alreadyImported = new Set(
          (
            await db.timeEntry.findMany({
              where: { clockifyId: { in: entries.map((e) => e.id) } },
              select: { clockifyId: true },
            })
          ).map((e) => e.clockifyId!),
        );

        for (const entry of entries) {
          const decision = decideImport(entry, { alreadyImported, projectByClockifyId });
          if (!decision.keep) {
            note(decision.reason!);
            continue;
          }
          // Une écriture peut déborder sur le mois suivant : c'est son mois de
          // début qui décide, comme partout ailleurs dans l'appli.
          if (monthKeyOfIso(entry.timeInterval.start) !== month) {
            note("hors du mois demandé");
            continue;
          }
          const projectId = projectByClockifyId.get(entry.projectId!)!;
          const studioId = studioByProjectId.get(projectId);
          if (!studioId) {
            note("projet sans studio rattaché");
            continue;
          }

          await db.timeEntry.create({
            data: {
              personId: person.id,
              projectId,
              studioId,
              startedAt: new Date(entry.timeInterval.start),
              endedAt: new Date(entry.timeInterval.end!),
              note: entry.description || null,
              clockifyId: entry.id,
            },
          });
          report.imported++;
        }

        if (entries.length < 200) break;
      }
    }

    report.skipped = [...skipped.entries()].map(([reason, count]) => ({ reason, count }));

    await db.journalEntry.create({
      data: {
        actorId: guard.session.user.personId,
        actorName: await currentActorName(guard.session),
        action: `Import Clockify du mois ${month} — ${report.imported} écriture(s) reprise(s)`,
      },
    });

    revalidatePath("/temps");
    revalidatePath("/tableau-de-bord");
    revalidatePath("/reglages");
    return report;
  } catch (e) {
    return { error: readableError(e) };
  }
}
