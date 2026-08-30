import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listActiveTasksForListing } from "@/lib/data/tasks";
import { KanbanView } from "./kanban-view";

export default async function KanbanPage() {
  const [tasks, studios, people, projects] = await Promise.all([
    listActiveTasksForListing(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
  ]);
  return (
    <div className="px-8 py-8">
      <h1 className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Kanban
      </h1>
      <KanbanView tasks={tasks} studios={studios} people={people} projects={projects} />
    </div>
  );
}
