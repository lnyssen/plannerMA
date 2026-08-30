import { listClients } from "@/lib/data/clients";
import { listProjectsWithCounts } from "@/lib/data/projects";
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
  const [projects, studios, clients, statuses] = await Promise.all([
    listProjectsWithCounts(showArchived),
    listStudios(),
    listClients(),
    listTaskStatuses(),
  ]);

  return (
    <ProjectsView
      projects={projects}
      studios={studios}
      clients={clients}
      statuses={statuses}
      showArchived={showArchived}
      initialOpenProjectId={open ?? null}
    />
  );
}
