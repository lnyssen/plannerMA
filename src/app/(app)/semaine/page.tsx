import { db } from "@/lib/db";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { addDays, fromIsoDate, mondayOf, toIsoDate, today } from "@/lib/planning/dates";
import { SemaineView } from "./semaine-view";

export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string }>;
}) {
  const { debut } = await searchParams;
  const monday = debut ? mondayOf(fromIsoDate(debut)) : mondayOf(fromIsoDate(today()));
  const mondayIso = toIsoDate(monday);
  const rangeEnd = toIsoDate(addDays(monday, 6));

  const [people, tasks, studios, allPeople, projects] = await Promise.all([
    db.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.task.findMany({
      where: {
        trashedAt: null,
        startDate: { lte: fromIsoDate(rangeEnd) },
        endDate: { gte: fromIsoDate(mondayIso) },
      },
      include: { studio: true, project: true },
    }),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
  ]);

  return (
    <SemaineView
      monday={mondayIso}
      people={people}
      tasks={tasks}
      studios={studios}
      projects={projects}
      allPeople={allPeople}
    />
  );
}
