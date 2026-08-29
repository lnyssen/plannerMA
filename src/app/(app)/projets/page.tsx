import { StudioBadge } from "@/components/ui/studio-badge";
import { listProjectsWithCounts, type ProjectWithCounts } from "@/lib/data/projects";

function ProjectCard({ project }: { project: ProjectWithCounts }) {
  const count = project._count.tasks;
  return (
    <div className="border border-line p-4">
      <div className="mb-1 font-[family-name:var(--font-body)] text-base font-bold text-rail">
        {project.name}
      </div>
      <div className="mb-3 text-sm text-ink">{project.client}</div>
      {project.studios.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {project.studios.map(({ studio }) => (
            <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
          ))}
        </div>
      )}
      <div className="text-sm font-semibold text-ink">
        {count} tâche{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function ProjectGroup({ title, projects }: { title: string; projects: ProjectWithCounts[] }) {
  if (projects.length === 0) return null;
  return (
    <section className="mb-10">
      <p className="mb-3 font-[family-name:var(--font-display)] text-sm font-medium tracking-[-0.1px] text-rail">
        {title}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}

export default async function ProjetsPage() {
  const projects = await listProjectsWithCounts();
  const internal = projects.filter((p) => p.type === "INTERNAL");
  const external = projects.filter((p) => p.type === "EXTERNAL");

  return (
    <div className="px-8 py-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Projets
      </h1>

      {projects.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Aucun projet. Utilisez « Nouveau projet » dans la barre latérale pour commencer.
        </p>
      ) : (
        <>
          <ProjectGroup title="Clients internes" projects={internal} />
          <ProjectGroup title="Clients externes" projects={external} />
        </>
      )}
    </div>
  );
}
