import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRunningTimer } from "@/lib/actions/time-entries";
import {
  listAllTimeEntries,
  listProjectsWithBudget,
  listTimeEntriesForPerson,
} from "@/lib/data/time-entries";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskCategories } from "@/lib/data/task-categories";
import { listActiveTasksForForms } from "@/lib/data/tasks";
import { TempsView } from "./temps-view";

export default async function TempsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const isAdmin = session.user.role === "ADMIN";
  const [myEntries, runningTimer, tasks, studios, projects, categories, allEntries, projectsWithBudget] = await Promise.all([
    session.user.personId ? listTimeEntriesForPerson(session.user.personId) : Promise.resolve([]),
    getRunningTimer(),
    listActiveTasksForForms(),
    listStudios(),
    listActiveProjectsForForms(),
    listTaskCategories(),
    isAdmin ? listAllTimeEntries() : Promise.resolve([]),
    isAdmin ? listProjectsWithBudget() : Promise.resolve([]),
  ]);

  return (
    <TempsView
      myEntries={myEntries}
      runningTimer={runningTimer}
      tasks={tasks}
      studios={studios}
      projects={projects}
      categories={categories}
      allEntries={allEntries}
      projectsWithBudget={projectsWithBudget}
      isAdmin={isAdmin}
      hasPerson={!!session.user.personId}
    />
  );
}
