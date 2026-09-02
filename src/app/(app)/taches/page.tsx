import { redirect } from "next/navigation";
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
  searchParams: Promise<{ open?: string; projet?: string }>;
}) {
  const { open, projet } = await searchParams;
  // Anciens liens profonds (notifications déjà en base, courriels déjà
  // envoyés) — voir src/lib/actions/tasks.ts, comments.ts, time-entries.ts,
  // src/lib/mail/templates.ts. Les nouveaux liens pointent directement sur
  // /taches/[id] ; ce redirect garde les anciens fonctionnels indéfiniment.
  if (open) redirect(`/taches/${open}`);

  const [tasks, studios, people, projects, statuses] = await Promise.all([
    listActiveTasksForListing(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listTaskStatuses(),
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
        initialProjectFilter={projet ? [projet] : []}
      />
    </div>
  );
}
