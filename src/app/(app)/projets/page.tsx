import { redirect } from "next/navigation";
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
  // Ancien lien profond (recherche globale) — voir src/components/shell/global-search.tsx.
  if (open) redirect(`/projets/${open}`);

  const showArchived = archives === "1";
  const [projects, studios, statuses] = await Promise.all([
    listProjectsWithCounts(showArchived),
    listStudios(),
    listTaskStatuses(),
  ]);

  return <ProjectsView projects={projects} studios={studios} statuses={statuses} showArchived={showArchived} />;
}
