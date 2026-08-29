import { listTasksForGantt } from "@/lib/data/gantt";
import { GanttChart } from "./gantt-chart";

export default async function GanttPage() {
  const tasks = await listTasksForGantt();
  return <GanttChart initialTasks={tasks} />;
}
