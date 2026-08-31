import Link from "next/link";
import { auth } from "@/auth";
import { getProjectDetail } from "@/lib/actions/projects";
import { listClients } from "@/lib/data/clients";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { secondaryButtonClass } from "@/components/ui/buttons";
import { EditProjectView } from "./edit-project-view";

export default async function ProjetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, project, studios, clients, people, activeProjects] = await Promise.all([
    auth(),
    getProjectDetail(id),
    listStudios(),
    listClients(),
    listPeople(),
    listActiveProjectsForForms(),
  ]);

  if (!project) {
    return (
      <div className="px-8 py-8">
        <h1 className="mb-3 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Projet introuvable
        </h1>
        <p className="mb-4 text-sm text-ink-muted">Ce projet n’existe plus.</p>
        <Link href="/projets" className={`inline-flex px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <EditProjectView
      initialProject={project}
      studios={studios}
      clients={clients}
      people={people}
      activeProjects={activeProjects}
      isAdmin={session?.user.role === "ADMIN"}
    />
  );
}
