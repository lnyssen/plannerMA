import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listMonthlyHoursByStudio, listProjectsWithBudget } from "@/lib/data/time-entries";
import { addDays, fromIsoDate, toIsoDate, today } from "@/lib/planning/dates";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  // Données budgétaires — réservé aux administrateurs, même règle que
  // listProjectsWithBudget (voir src/lib/data/time-entries.ts).
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const todayDate = fromIsoDate(today());
  const horizon = addDays(todayDate, 30);

  // Repères d'activité affichés même quand aucun projet ne porte de budget
  // de temps : sans eux, le tableau de bord pouvait être entièrement vide,
  // ce qui est le pire état possible pour la page censée donner la vue
  // d'ensemble.
  const [projects, statuses, milestones, monthlyHours, activeProjects, activeTasks, lateTasks, unassignedTasks] =
    await Promise.all([
    listProjectsWithBudget(),
    listTaskStatuses(),
    // En retard (dueDate dépassée, pas faite) ou à venir sous 30 jours — pas
    // tout l'avenir : cette vue sert à voir venir la prochaine échéance sans
    // ouvrir chaque fiche projet, pas à lister tous les dates clés existants.
    db.milestone.findMany({
      where: { isDone: false, dueDate: { lte: horizon }, project: { archived: false } },
      orderBy: { dueDate: "asc" },
      include: { project: { select: { name: true, client: { select: { name: true } } } } },
    }),
    listMonthlyHoursByStudio(),
    db.project.count({ where: { archived: false } }),
    db.task.count({ where: { trashedAt: null, status: { isDone: false } } }),
    db.task.count({ where: { trashedAt: null, status: { isDone: false }, endDate: { lt: todayDate } } }),
    db.task.count({ where: { trashedAt: null, status: { isDone: false }, assigneeId: null } }),
  ]);

  return (
    <DashboardView
      activity={{ activeProjects, activeTasks, lateTasks, unassignedTasks }}
      monthlyHours={monthlyHours}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        pole: p.pole,
        budgetHours: p.budgetHours!,
        timeEntries: [...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)],
        taskStatuses: p.tasks.map((t) => t.status),
      }))}
      allStatuses={statuses.map((s) => ({ position: s.position, isDone: s.isDone }))}
      milestones={milestones.map((m) => ({
        id: m.id,
        title: m.title,
        dueDate: toIsoDate(m.dueDate),
        projectName: m.project.name,
        clientName: m.project.client.name,
      }))}
    />
  );
}
