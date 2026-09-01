import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getRunningTimer } from "@/lib/actions/time-entries";
import { addDays, fromIsoDate, toIsoDate, today } from "@/lib/planning/dates";
import { TodayView } from "./today-view";

export default async function TodayPage() {
  const session = await auth();
  const personId = session?.user.personId ?? null;
  const isAdmin = session?.user.role === "ADMIN";
  const todayDate = fromIsoDate(today());
  const horizon = addDays(todayDate, 14);

  const [myTasks, runningTimer, absences, person] = await Promise.all([
    personId
      ? db.task.findMany({
          where: {
            assigneeId: personId,
            trashedAt: null,
            status: { isDone: false },
            startDate: { lte: todayDate },
            endDate: { gte: todayDate },
          },
          orderBy: { endDate: "asc" },
          include: { project: { include: { client: true } }, studio: true, status: true },
        })
      : Promise.resolve([]),
    getRunningTimer(),
    // Fenêtre de coordination courte (14 jours) plutôt que tout l'avenir —
    // même esprit que le calendrier d'équipe : utile pour prévoir la semaine
    // qui vient, pas un historique à faire défiler.
    db.absence.findMany({
      where: { endDate: { gte: todayDate }, startDate: { lte: horizon } },
      orderBy: { startDate: "asc" },
      include: { person: { select: { id: true, name: true } } },
    }),
    // Jamais session.user.name (figé au login, voir (app)/layout.tsx pour le
    // même correctif) : toujours relu depuis la fiche personne.
    personId ? db.person.findUnique({ where: { id: personId }, select: { name: true } }) : Promise.resolve(null),
  ]);

  return (
    <TodayView
      userName={person?.name ?? session?.user.email ?? "—"}
      tasks={myTasks.map((t) => ({
        id: t.id,
        title: t.title,
        endDate: toIsoDate(t.endDate),
        project: t.project ? { name: t.project.name, client: { name: t.project.client.name } } : null,
        studio: { name: t.studio.name, fillHex: t.studio.fillHex, colorHex: t.studio.colorHex },
        status: { name: t.status.name, fillHex: t.status.fillHex, colorHex: t.status.colorHex },
      }))}
      runningTimer={runningTimer}
      absences={absences.map((a) => ({
        id: a.id,
        personId: a.personId,
        personName: a.person.name,
        startDate: toIsoDate(a.startDate),
        endDate: toIsoDate(a.endDate),
        reason: isAdmin || a.personId === personId ? a.reason : null,
        mine: a.personId === personId,
      }))}
    />
  );
}
