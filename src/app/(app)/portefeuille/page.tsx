import { listClients } from "@/lib/data/clients";
import { listProjectsWithCounts } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { PortfolioView } from "./portfolio-view";

export default async function PortefeuillePage() {
  const [projects, studios, clients, statuses] = await Promise.all([
    listProjectsWithCounts(false),
    listStudios(),
    listClients(),
    listTaskStatuses(),
  ]);

  return <PortfolioView projects={projects} studios={studios} clients={clients} statuses={statuses} />;
}
