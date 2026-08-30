"use client";

import { Archive } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EditProjectModal } from "@/components/modals/edit-project-modal";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { ClientSummary } from "@/lib/data/clients";
import type { ProjectWithCounts } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";

function ProjectCard({ project, onOpen }: { project: ProjectWithCounts; onOpen: (id: string) => void }) {
  const count = project._count.tasks;
  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="border border-line p-4 text-left"
      title="Modifier le projet"
    >
      <div className="mb-1 font-[family-name:var(--font-body)] text-base font-bold text-rail">{project.name}</div>
      <div className="mb-3 text-sm text-ink">{project.client.name}</div>
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
    </button>
  );
}

function ProjectGroup({ title, projects, onOpen }: { title: string; projects: ProjectWithCounts[]; onOpen: (id: string) => void }) {
  if (projects.length === 0) return null;
  return (
    <section className="mb-10">
      <p className="mb-3 font-[family-name:var(--font-display)] text-sm font-medium tracking-[-0.1px] text-rail">
        {title}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function ProjectsView({
  projects,
  studios,
  clients,
  showArchived,
}: {
  projects: ProjectWithCounts[];
  studios: StudioSummary[];
  clients: ClientSummary[];
  showArchived: boolean;
}) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const internal = projects.filter((p) => p.type === "INTERNAL");
  const external = projects.filter((p) => p.type === "EXTERNAL");

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Projets
        </h1>
        <span className="flex-1" />
        <Link
          href={showArchived ? "/projets" : "/projets?archives=1"}
          className="flex items-center gap-1.5 border-[1.5px] border-heading px-3 py-1.5 text-sm font-semibold text-heading"
        >
          <Archive size={14} /> {showArchived ? "Projets actifs" : "Archives"}
        </Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {showArchived
            ? "Aucun projet archivé."
            : "Aucun projet. Utilisez « Nouveau projet » dans la barre latérale pour commencer."}
        </p>
      ) : (
        <>
          <ProjectGroup title="Clients internes" projects={internal} onOpen={setOpenProjectId} />
          <ProjectGroup title="Clients externes" projects={external} onOpen={setOpenProjectId} />
        </>
      )}

      {openProjectId && (
        <EditProjectModal
          projectId={openProjectId}
          studios={studios}
          clients={clients}
          onClose={() => setOpenProjectId(null)}
        />
      )}
    </div>
  );
}
