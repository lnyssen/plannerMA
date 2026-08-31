import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listActiveTasksForListing } from "@/lib/data/tasks";
import { TasksTable } from "../taches/tasks-table";

export default async function MesTachesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const [allTasks, studios, people, projects, statuses] = await Promise.all([
    listActiveTasksForListing(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listTaskStatuses(),
  ]);

  const myTasks = allTasks.filter((t) => t.assigneeId === session.user.personId);

  return (
    <div className="px-8 py-8">
      <h1 className="mb-5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Mes tâches
      </h1>
      {!session.user.personId ? (
        <p className="text-sm text-ink-muted">
          Votre compte n’est relié à aucune fiche personne — aucune tâche ne peut vous être attribuée.
        </p>
      ) : (
        <TasksTable
          tasks={myTasks}
          studios={studios}
          people={people}
          projects={projects}
          statuses={statuses}
          hidePersonFilter
          hidePersonColumn
        />
      )}
    </div>
  );
}
