import { listTasksForGantt } from "@/lib/data/gantt";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { GanttChart } from "./gantt-chart";

export default async function GanttPage() {
  const [tasks, studios, people, projects] = await Promise.all([
    listTasksForGantt(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
  ]);
  return <GanttChart initialTasks={tasks} studios={studios} people={people} projects={projects} />;
}
