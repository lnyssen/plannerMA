import Link from "next/link";
import { getTaskDetail } from "@/lib/actions/tasks";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listActiveTasksForListing } from "@/lib/data/tasks";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { TaskDetailView } from "./task-detail-view";

export default async function TacheDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [task, studios, people, projects, statuses, allTasks] = await Promise.all([
    getTaskDetail(id),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listTaskStatuses(),
    listActiveTasksForListing(),
  ]);

  if (!task) {
    return (
      <div className="px-8 py-8">
        <h1 className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Tâche introuvable
        </h1>
        <p className="mb-4 text-sm text-ink-muted">Cette tâche n’existe plus.</p>
        <Link href="/taches" className={`inline-flex px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <TaskDetailView
      initialTask={task}
      studios={studios}
      projects={projects}
      people={people}
      statuses={statuses}
      tasks={allTasks.map((t) => ({ id: t.id, title: t.title, studioId: t.studioId, project: t.project }))}
    />
  );
}
