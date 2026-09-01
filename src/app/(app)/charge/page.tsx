import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadChargeData } from "@/lib/data/charge";
import { listAllTimeEntries } from "@/lib/data/time-entries";
import { toIsoDate } from "@/lib/planning/dates";
import { ChargeView } from "./charge-view";

export default async function ChargePage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [[people, tasks, absences], timeEntries] = await Promise.all([loadChargeData(), listAllTimeEntries()]);
  const visiblePersonIds = new Set(people.map((p) => p.id));

  return (
    <ChargeView
      people={people.map((p) => ({ id: p.id, name: p.name, external: p.external, studios: p.studios.map((s) => s.studio.name) }))}
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
