import { listActiveTasksForListing } from "@/lib/data/tasks";
import { TasksTable } from "./tasks-table";

export default async function TachesPage() {
  const tasks = await listActiveTasksForListing();
  return (
    <div className="px-8 py-8">
      <h1 className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Tâches
      </h1>
      <TasksTable tasks={tasks} />
    </div>
  );
}
