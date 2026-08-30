import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadChargeData } from "@/lib/data/charge";
import { toIsoDate } from "@/lib/planning/dates";
import { ChargeView } from "./charge-view";

export default async function ChargePage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [people, tasks, absences] = await loadChargeData();

  return (
    <ChargeView
      people={people.map((p) => ({ id: p.id, name: p.name, studios: p.studios.map((s) => s.studio.name) }))}
      tasks={tasks.map((t) => ({
        personId: t.assigneeId!,
        status: t.status,
        startDate: toIsoDate(t.startDate),
        endDate: toIsoDate(t.endDate),
      }))}
      absences={absences.map((a) => ({
        personId: a.personId,
        startDate: toIsoDate(a.startDate),
        endDate: toIsoDate(a.endDate),
      }))}
    />
  );
}
