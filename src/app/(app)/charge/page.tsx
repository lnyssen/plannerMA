import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadChargeData } from "@/lib/data/charge";
import { listAllTimeEntries } from "@/lib/data/time-entries";
import { toIsoDate } from "@/lib/planning/dates";
import { ChargeView } from "./charge-view";

export default async function ChargePage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN" && session?.user.role !== "STUDIO_LEAD") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [[people, tasks, absences], timeEntries] = await Promise.all([loadChargeData(), listAllTimeEntries()]);

  // Un responsable de studio ne voit que son (ou ses) propre(s) studio(s) —
  // un admin voit tout le monde. Voir la même règle dans absences.ts
  // (canManageAbsenceFor) pour qui peut gérer les absences de ces personnes.
  const visiblePeople =
    session.user.role === "ADMIN"
      ? people
      : (() => {
          const myStudioIds = new Set(
            people.find((p) => p.id === session.user.personId)?.studios.map((s) => s.studioId) ?? [],
          );
          return people.filter((p) => p.studios.some((s) => myStudioIds.has(s.studioId)));
        })();
  const visiblePersonIds = new Set(visiblePeople.map((p) => p.id));

  return (
    <ChargeView
      people={visiblePeople.map((p) => ({ id: p.id, name: p.name, external: p.external, studios: p.studios.map((s) => s.studio.name) }))}
      tasks={tasks
        .filter((t) => visiblePersonIds.has(t.assigneeId!))
        .map((t) => ({
          personId: t.assigneeId!,
          isDone: t.status.isDone,
          startDate: toIsoDate(t.startDate),
          endDate: toIsoDate(t.endDate),
          estimatedHalfDays: t.estimatedHalfDays,
        }))}
      absences={absences
        .filter((a) => visiblePersonIds.has(a.personId))
        .map((a) => ({
          personId: a.personId,
          startDate: toIsoDate(a.startDate),
          endDate: toIsoDate(a.endDate),
        }))}
      timeEntries={timeEntries
        .filter((e) => visiblePersonIds.has(e.person.id))
        .map((e) => ({
          personId: e.person.id,
          startedAt: e.startedAt,
          endedAt: e.endedAt,
        }))}
    />
  );
}
