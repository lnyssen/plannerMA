import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRunningTimer } from "@/lib/actions/time-entries";
import {
  listAllTimeEntries,
  listProjectsWithBudget,
  listTimeEntriesForPerson,
} from "@/lib/data/time-entries";
import { listActiveTasksForForms } from "@/lib/data/tasks";
import { TempsView } from "./temps-view";

export default async function TempsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const isAdmin = session.user.role === "ADMIN";
  const [myEntries, runningTimer, tasks, allEntries, projectsWithBudget] = await Promise.all([
    session.user.personId ? listTimeEntriesForPerson(session.user.personId) : Promise.resolve([]),
    getRunningTimer(),
    listActiveTasksForForms(),
    isAdmin ? listAllTimeEntries() : Promise.resolve([]),
    isAdmin ? listProjectsWithBudget() : Promise.resolve([]),
  ]);

  return (
    <TempsView
      myEntries={myEntries}
      runningTimer={runningTimer}
      tasks={tasks}
      allEntries={allEntries}
      projectsWithBudget={projectsWithBudget}
      isAdmin={isAdmin}
      hasPerson={!!session.user.personId}
    />
  );
}
