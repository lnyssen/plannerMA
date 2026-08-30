import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listActiveTasksForListing } from "@/lib/data/tasks";
import { TasksTable } from "./tasks-table";

export default async function TachesPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const [tasks, studios, people, projects, statuses, { open }] = await Promise.all([
    listActiveTasksForListing(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listTaskStatuses(),
    searchParams,
  ]);
  return (
    <div className="px-8 py-8">
      <h1 className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Tâches
      </h1>
      <TasksTable
        tasks={tasks}
        studios={studios}
        people={people}
        projects={projects}
        statuses={statuses}
        dependencyOptions={tasks.map((t) => ({ id: t.id, title: t.title, project: t.project }))}
        initialOpenTaskId={open ?? null}
      />
    </div>
  );
}
