"use client";

import { Archive } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EditProjectModal } from "@/components/modals/edit-project-modal";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { ClientSummary } from "@/lib/data/clients";
import type { ProjectWithCounts } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { taskProgress } from "@/lib/planning/tasks";

function averageProgress(project: ProjectWithCounts): number {
  if (project.tasks.length === 0) return 0;
  const total = project.tasks.reduce((sum, t) => sum + taskProgress(t.status, []), 0);
  return total / project.tasks.length;
}

function ProjectCard({ project, onOpen }: { project: ProjectWithCounts; onOpen: (id: string) => void }) {
  const count = project._count.tasks;
  const progress = averageProgress(project);

  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="border border-line p-4 text-left transition-colors duration-100 hover:border-heading active:bg-wash"
      title="Modifier le projet"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="font-[family-name:var(--font-body)] text-base font-bold text-rail">{project.name}</div>
        <span className="flex-shrink-0 px-1.5 py-0.5 text-2xs font-semibold text-ink-muted uppercase" style={{ background: "var(--color-wash)" }}>
          {project.type === "INTERNAL" ? "Interne" : "Externe"}
        </span>
      </div>
      <div className="mb-3 text-sm text-ink">{project.client.name}</div>
      {project.studios.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {project.studios.map(({ studio }) => (
            <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
          ))}
        </div>
      )}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-line">
          <div className="h-full bg-heading" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="text-2xs tabular-nums text-ink-muted">{Math.round(progress * 100)}%</span>
      </div>
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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => `${p.name} ${p.client.name}`.toLowerCase().includes(q));
  }, [projects, search]);

  const internal = filtered.filter((p) => p.type === "INTERNAL");
  const external = filtered.filter((p) => p.type === "EXTERNAL");

  return (
    <div className="px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Projets
        </h1>
        <span className="flex-1" />
        <Link
          href={showArchived ? "/projets" : "/projets?archives=1"}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
        >
          <Archive size={14} /> {showArchived ? "Projets actifs" : "Archives"}
        </Link>
      </div>

      <input
        type="text"
        placeholder="Rechercher un projet, un client…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 w-full max-w-md border-[1.5px] border-heading px-3 py-2.5 text-sm text-ink outline-none"
      />

      {projects.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {showArchived
            ? "Aucun projet archivé."
            : "Aucun projet. Utilisez « Nouveau projet » dans la barre latérale pour commencer."}
        </p>
      ) : filtered.length === 0 ? (
        <div className="border border-line p-16 text-center">
          <p className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-heading">
            Aucun projet ne correspond
          </p>
          <p className="text-sm text-ink">Essayez une autre recherche.</p>
        </div>
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
