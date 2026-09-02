import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { listProjectsWithBudget } from "@/lib/data/time-entries";
import { SubventionsView } from "./subventions-view";

const GRANT_TYPES = ["EDUCATION_PERMANENTE", "EUROPEEN"] as const;

export default async function SubventionsPage() {
  const session = await auth();
  // Même règle que Charge/Tableau de bord : données de budget/équipe, réservées aux administrateurs.
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [projects, statuses] = await Promise.all([listProjectsWithBudget(), listTaskStatuses()]);

  return (
    <SubventionsView
      projects={projects
        .filter((p) => (GRANT_TYPES as readonly string[]).includes(p.pole ?? ""))
        .map((p) => ({
          id: p.id,
          name: p.name,
          clientName: p.client.name,
          pole: p.pole,
          budgetHours: p.budgetHours!,
          timeEntries: [...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)],
          taskStatuses: p.tasks.map((t) => t.status),
        }))}
      allStatuses={statuses.map((s) => ({ position: s.position, isDone: s.isDone }))}
    />
  );
}
