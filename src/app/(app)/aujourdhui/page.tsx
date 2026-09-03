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

  // Trois fenêtres plutôt qu'une : ce qui a débordé, ce qui est prévu
  // aujourd'hui, ce qui arrive. L'écran d'accueil ne montrait que la fenêtre
  // du milieu — donc rien du tout les jours sans tâche planifiée, alors même
  // que des échéances étaient dépassées.
  const TASK_INCLUDE = {
    project: { include: { client: true } },
    studios: { include: { studio: true } },
    status: true,
  } as const;
  const mine = { assigneeId: personId ?? "", trashedAt: null, status: { isDone: false } };
  const semaine = addDays(todayDate, 7);

  const [lateTasks, myTasks, soonTasks, runningTimer, absences, person] = await Promise.all([
    personId
      ? db.task.findMany({
          where: { ...mine, endDate: { lt: todayDate } },
          orderBy: { endDate: "asc" },
          include: TASK_INCLUDE,
        })
      : Promise.resolve([]),
    personId
      ? db.task.findMany({
          where: { ...mine, startDate: { lte: todayDate }, endDate: { gte: todayDate } },
          orderBy: { endDate: "asc" },
          include: TASK_INCLUDE,
        })
      : Promise.resolve([]),
    personId
      ? db.task.findMany({
          where: { ...mine, startDate: { gt: todayDate, lte: semaine } },
          orderBy: { startDate: "asc" },
          take: 8,
          include: TASK_INCLUDE,
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

  const toTask = (t: (typeof myTasks)[number]) => ({
    id: t.id,
    title: t.title,
    startDate: toIsoDate(t.startDate),
    endDate: toIsoDate(t.endDate),
    project: t.project ? { name: t.project.name, client: { name: t.project.client.name } } : null,
    studios: t.studios.map((s) => ({ id: s.studio.id, name: s.studio.name, fillHex: s.studio.fillHex, colorHex: s.studio.colorHex })),
    status: { name: t.status.name, fillHex: t.status.fillHex, colorHex: t.status.colorHex },
  });

  return (
    <TodayView
      userName={person?.name ?? session?.user.email ?? "—"}
      lateTasks={lateTasks.map(toTask)}
      tasks={myTasks.map(toTask)}
      soonTasks={soonTasks.map(toTask)}
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
