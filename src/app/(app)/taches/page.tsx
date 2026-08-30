import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listActiveTasksForListing } from "@/lib/data/tasks";
import { TasksTable } from "./tasks-table";

export default async function TachesPage() {
  const [tasks, studios, people, projects] = await Promise.all([
    listActiveTasksForListing(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
  ]);
  return (
    <div className="px-8 py-8">
      <h1 className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Tâches
      </h1>
      <TasksTable tasks={tasks} studios={studios} people={people} projects={projects} />
    </div>
  );
}
