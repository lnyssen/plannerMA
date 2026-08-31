import { auth } from "@/auth";
import { listClients } from "@/lib/data/clients";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms, listProjectsWithCounts } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { ProjectsView } from "./projects-view";

export default async function ProjetsPage({
  searchParams,
}: {
  searchParams: Promise<{ archives?: string; open?: string }>;
}) {
  const { archives, open } = await searchParams;
  const showArchived = archives === "1";
  const [session, projects, studios, clients, statuses, people, activeProjects] = await Promise.all([
    auth(),
    listProjectsWithCounts(showArchived),
    listStudios(),
    listClients(),
    listTaskStatuses(),
    listPeople(),
    listActiveProjectsForForms(),
  ]);

  return (
    <ProjectsView
      projects={projects}
      studios={studios}
      clients={clients}
      statuses={statuses}
      people={people}
      activeProjects={activeProjects}
      showArchived={showArchived}
      isAdmin={session?.user.role === "ADMIN"}
      initialOpenProjectId={open ?? null}
    />
  );
}
