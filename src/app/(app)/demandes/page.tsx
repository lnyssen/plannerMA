import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listRequests } from "@/lib/data/requests";
import { listStudios } from "@/lib/data/studios";
import { listActiveTasksForForms } from "@/lib/data/tasks";
import { DemandesView } from "./demandes-view";

export default async function DemandesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [requests, studios, people, projects, tasks] = await Promise.all([
    listRequests(),
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listActiveTasksForForms(),
  ]);

  return <DemandesView requests={requests} studios={studios} people={people} projects={projects} tasks={tasks} />;
}
