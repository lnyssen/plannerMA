import { CreateButton } from "@/components/shell/create-button";
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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Tâches
        </h1>
        <span className="flex-1" />
        <CreateButton kind="task" />
      </div>
      <TasksTable
        tasks={tasks}
        studios={studios}
        people={people}
        projects={projects}
        statuses={statuses}
        dependencyOptions={tasks.map((t) => ({ id: t.id, title: t.title, studioId: t.studioId, project: t.project }))}
        initialOpenTaskId={open ?? null}
      />
    </div>
  );
}
