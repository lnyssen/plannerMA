import { listTasksForGantt } from "@/lib/data/gantt";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listActiveTasksForListing } from "@/lib/data/tasks";
import { db } from "@/lib/db";
import { addDays, fromIsoDate, mondayOf, toIsoDate, today } from "@/lib/planning/dates";
import { PlanningView, type PlanningTab } from "./planning-view";

const TABS: PlanningTab[] = ["gantt", "kanban", "semaine"];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string; debut?: string }>;
}) {
  const { vue, debut } = await searchParams;
  const initialTab = TABS.includes(vue as PlanningTab) ? (vue as PlanningTab) : "gantt";

  const monday = debut ? mondayOf(fromIsoDate(debut)) : mondayOf(fromIsoDate(today()));
  const mondayIso = toIsoDate(monday);
  const rangeEnd = toIsoDate(addDays(monday, 6));

  const [ganttTasks, boardTasks, weekPeople, weekTasks, studios, people, projects, statuses] = await Promise.all([
    listTasksForGantt(),
    listActiveTasksForListing(),
    db.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.task.findMany({
      where: {
        trashedAt: null,
        startDate: { lte: fromIsoDate(rangeEnd) },
        endDate: { gte: fromIsoDate(mondayIso) },
        // Un projet archivé sort ses tâches de la vue Semaine (voir src/lib/data/tasks.ts).
        OR: [{ projectId: null }, { project: { archived: false } }],
      },
      include: { studio: true, project: { include: { client: true } } },
    }),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listTaskStatuses(),
  ]);

  return (
    <PlanningView
      initialTab={initialTab}
      monday={mondayIso}
      weekPeople={weekPeople}
      weekTasks={weekTasks}
      ganttTasks={ganttTasks}
      boardTasks={boardTasks}
      studios={studios}
      people={people}
      projects={projects}
      statuses={statuses}
      dependencyOptions={boardTasks.map((t) => ({ id: t.id, title: t.title, studioId: t.studioId, project: t.project }))}
    />
  );
}
