"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { currentActorName } from "./actor";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Mois invalide.");

/** Premier jour du mois, à minuit UTC — la forme stockée dans TimesheetPeriod.month. */
export async function monthStart(month: string): Promise<Date> {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1));
}

function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Une écriture est-elle verrouillée par la feuille de temps de son mois ?
 *
 * Le verrou porte sur le couple personne/mois, pas sur l'écriture : c'est le
 * mois entier qu'on remet et qu'on valide. Une écriture nouvellement créée
 * dans un mois déjà remis doit donc être refusée elle aussi — sans quoi le
 * verrou ne prouverait rien.
 *
 * `null` = rien ne s'y oppose ; sinon, le message à afficher.
 */
export async function timesheetLockFor(personId: string, date: Date): Promise<string | null> {
  const period = await db.timesheetPeriod.findUnique({
    where: { personId_month: { personId, month: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) } },
    select: { status: true },
  });
  if (!period || period.status === "DRAFT") return null;
  return period.status === "SUBMITTED"
    ? "Cette feuille de temps est remise pour validation — demandez sa réouverture pour la modifier."
    : "Cette feuille de temps est validée et verrouillée.";
}

function revalidateTimesheetViews() {
  revalidatePath("/temps");
  revalidatePath("/tableau-de-bord");
}

/** Feuilles de la personne connectée, mois par mois, sur `months` mois glissants. */
export async function listMyTimesheets(months = 6) {
  const session = await auth();
  if (!session?.user.personId) return [];
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  const [periods, entries] = await Promise.all([
    db.timesheetPeriod.findMany({
      where: { personId: session.user.personId, month: { gte: first } },
      include: { reviewedBy: { select: { name: true } } },
    }),
    db.timeEntry.findMany({
      where: { personId: session.user.personId, startedAt: { gte: first } },
      select: { startedAt: true, endedAt: true },
    }),
  ]);

  const byMonth = new Map(periods.map((p) => [monthKeyOf(p.month), p]));
  const minutesByMonth = new Map<string, number>();
  for (const e of entries) {
    const key = monthKeyOf(e.startedAt);
    const minutes = Math.max(0, Math.round(((e.endedAt ?? now).getTime() - e.startedAt.getTime()) / 60_000));
    minutesByMonth.set(key, (minutesByMonth.get(key) ?? 0) + minutes);
  }

  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1));
    const key = monthKeyOf(d);
    const period = byMonth.get(key);
    return {
      month: key,
      minutes: minutesByMonth.get(key) ?? 0,
      status: period?.status ?? ("DRAFT" as const),
      submittedAt: period?.submittedAt ?? null,
      reviewedAt: period?.reviewedAt ?? null,
      reviewedByName: period?.reviewedBy?.name ?? null,
      note: period?.note ?? null,
    };
  }).reverse();
}

export type MyTimesheet = Awaited<ReturnType<typeof listMyTimesheets>>[number];

/**
 * Feuilles remises ou validées, côté administrateur.
 *
 * Les validées restent listées : sans elles, une feuille approuvée sortait de
 * l'écran et plus personne ne pouvait la rouvrir — un verrou sans clé, alors
 * que le modèle prévoit la réouverture (erreur de correction en base, mois
 * validé trop tôt).
 */
export async function listPendingTimesheets() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return [];
  const periods = await db.timesheetPeriod.findMany({
    where: { status: { in: ["SUBMITTED", "APPROVED"] } },
    orderBy: [{ status: "asc" }, { month: "desc" }],
    include: { person: { select: { id: true, name: true } } },
  });

  return Promise.all(
    periods.map(async (p) => {
      const next = new Date(Date.UTC(p.month.getUTCFullYear(), p.month.getUTCMonth() + 1, 1));
      const entries = await db.timeEntry.findMany({
        where: { personId: p.personId, startedAt: { gte: p.month, lt: next } },
        select: { startedAt: true, endedAt: true },
      });
      const minutes = entries.reduce(
        (sum, e) => sum + Math.max(0, Math.round(((e.endedAt ?? new Date()).getTime() - e.startedAt.getTime()) / 60_000)),
        0,
      );
      return {
        id: p.id,
        month: monthKeyOf(p.month),
        personName: p.person.name,
        status: p.status,
        submittedAt: p.submittedAt,
        minutes,
      };
    }),
  );
}

export type PendingTimesheet = Awaited<ReturnType<typeof listPendingTimesheets>>[number];

/** Remise par la personne elle-même : le mois se ferme à ses propres modifications. */
export async function submitTimesheet(month: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user.personId) return { error: "Votre compte n’est relié à aucune fiche personne." };
  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const start = await monthStart(month);
  // Remettre un mois pas encore terminé laisserait des jours non saisis
  // derrière un verrou, sans recours autre qu'une réouverture.
  const now = new Date();
  if (start >= new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))) {
    return { error: "Ce mois n’est pas terminé — attendez le mois suivant pour le remettre." };
  }

  const existing = await db.timesheetPeriod.findUnique({
    where: { personId_month: { personId: session.user.personId, month: start } },
    select: { status: true },
  });
  if (existing && existing.status !== "DRAFT") return { error: "Cette feuille est déjà remise." };

  await db.timesheetPeriod.upsert({
    where: { personId_month: { personId: session.user.personId, month: start } },
    update: { status: "SUBMITTED", submittedAt: new Date(), note: null },
    create: { personId: session.user.personId, month: start, status: "SUBMITTED", submittedAt: new Date() },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Feuille de temps ${month} remise pour validation`,
    },
  });

  revalidateTimesheetViews();
  return {};
}

const reviewSchema = z.object({
  periodId: z.string().min(1),
  decision: z.enum(["approve", "reopen"]),
  note: z.string().trim().max(500).nullable().optional(),
});

/** Validation ou réouverture par un administrateur. */
export async function reviewTimesheet(input: z.infer<typeof reviewSchema>): Promise<{ error?: string }> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { error: "Réservé aux administrateurs." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { periodId, decision, note } = parsed.data;

  const period = await db.timesheetPeriod.findUnique({
    where: { id: periodId },
    include: { person: { select: { name: true } } },
  });
  if (!period) return { error: "Feuille introuvable." };

  const updated = await db.timesheetPeriod.update({
    where: { id: periodId },
    data: {
      status: decision === "approve" ? "APPROVED" : "DRAFT",
      reviewedAt: new Date(),
      reviewedById: session.user.personId,
      // Le motif n'a de sens que sur une réouverture : c'est ce que la
      // personne doit corriger.
      note: decision === "reopen" ? (note ?? null) : null,
    },
  });

  await db.journalEntry.create({
    data: {
      actorId: session.user.personId,
      actorName: await currentActorName(session),
      action: `Feuille de temps ${monthKeyOf(updated.month)} de ${period.person.name} ${
        decision === "approve" ? "validée" : "rouverte"
      }`,
    },
  });

  revalidateTimesheetViews();
  return {};
}
