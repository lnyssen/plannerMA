import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { parseNavOrder } from "@/components/shell/nav-entries";
import { db } from "@/lib/db";
import { listClients } from "@/lib/data/clients";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";
import { listActiveTasksForForms } from "@/lib/data/tasks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, people, projects, clients, tasks, account, mesTachesCount, demandesCount] = await Promise.all([
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listClients(),
    listActiveTasksForForms(),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { notifyOnAssignment: true, notifyDailyDigest: true, navOrder: true },
    }),
    // "Mes tâches" en attente : hors corbeille, statut pas encore "Terminé" —
    // même repli à 0 si le compte n'est relié à aucune Person (ex. admin
    // technique sans fiche personne).
    session.user.personId
      ? db.task.count({
          where: { trashedAt: null, assigneeId: session.user.personId, status: { isDone: false } },
        })
      : Promise.resolve(0),
    // Demandes en file : la table Request ne garde que ce qui n'a pas encore
    // été converti en tâche (voir src/lib/actions/requests.ts) — son compte
    // total est donc déjà "en attente", pas besoin d'un filtre de statut.
    session.user.role === "ADMIN" ? db.request.count() : Promise.resolve(0),
  ]);

  return (
    <AppShell
      studios={studios}
      people={people}
      projects={projects}
      clients={clients}
      tasks={tasks}
      userName={session.user.name ?? session.user.email ?? "—"}
      role={session.user.role}
      notifyOnAssignment={account?.notifyOnAssignment ?? true}
      notifyDailyDigest={account?.notifyDailyDigest ?? true}
      navOrder={parseNavOrder(account?.navOrder ?? null)}
      counts={{ mesTaches: mesTachesCount, demandes: demandesCount }}
    >
      {children}
    </AppShell>
  );
}
