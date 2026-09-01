import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listProjectsWithBudget } from "@/lib/data/time-entries";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  // Données budgétaires — réservé aux administrateurs, même règle que
  // listProjectsWithBudget (voir src/lib/data/time-entries.ts).
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [projects, statuses] = await Promise.all([listProjectsWithBudget(), listTaskStatuses()]);

  return (
    <DashboardView
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.client.name,
        budgetHours: p.budgetHours!,
        timeEntries: [...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)],
        taskStatuses: p.tasks.map((t) => t.status),
      }))}
      allStatuses={statuses.map((s) => ({ position: s.position, isDone: s.isDone }))}
    />
  );
}
