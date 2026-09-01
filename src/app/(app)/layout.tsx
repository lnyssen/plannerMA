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
import { countProjectsOverBudget } from "@/lib/data/time-entries";
import { fromIsoDate, today } from "@/lib/planning/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, people, projects, clients, tasks, account, mesTachesCount, demandesCount, tasksLateCount, projectsOverBudgetCount] = await Promise.all([
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listClients(),
    listActiveTasksForForms(),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        notifyOnAssignment: true,
        notifyDailyDigest: true,
        notifyOnMention: true,
        notifyOnRequest: true,
        navOrder: true,
        theme: true,
        // Le nom affiché ne doit jamais venir de la session JWT (figée au
        // login) : si la fiche personne est renommée entre-temps, on veut
        // voir le nouveau nom dès le prochain chargement de page, pas
        // seulement après une reconnexion.
        person: { select: { name: true } },
      },
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
    // Tâches en retard : échéance dépassée, pas encore terminées, hors corbeille.
    db.task.count({
      where: { trashedAt: null, status: { isDone: false }, endDate: { lt: fromIsoDate(today()) } },
    }),
    countProjectsOverBudget(),
  ]);

  return (
    <AppShell
      studios={studios}
      people={people}
      projects={projects}
      clients={clients}
      tasks={tasks}
      userName={account?.person?.name ?? session.user.email ?? "—"}
      role={session.user.role}
      notifyOnAssignment={account?.notifyOnAssignment ?? true}
      notifyDailyDigest={account?.notifyDailyDigest ?? true}
      notifyOnMention={account?.notifyOnMention ?? true}
      notifyOnRequest={account?.notifyOnRequest ?? true}
      navOrder={parseNavOrder(account?.navOrder ?? null)}
      theme={account?.theme ?? "LIGHT"}
      counts={{ mesTaches: mesTachesCount, demandes: demandesCount, tasksLate: tasksLateCount, projectsOverBudget: projectsOverBudgetCount }}
    >
      {children}
    </AppShell>
  );
}
