import { listClients } from "@/lib/data/clients";
import { listProjectsWithCounts } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { ProjectsView } from "./projects-view";

export default async function ProjetsPage({
  searchParams,
}: {
  searchParams: Promise<{ archives?: string }>;
}) {
  const { archives } = await searchParams;
  const showArchived = archives === "1";
  const [projects, studios, clients] = await Promise.all([
    listProjectsWithCounts(showArchived),
    listStudios(),
    listClients(),
  ]);

  return <ProjectsView projects={projects} studios={studios} clients={clients} showArchived={showArchived} />;
}
