import { db } from "@/lib/db";
import { listStudios } from "@/lib/data/studios";
import { EquipeView } from "./equipe-view";

export default async function EquipePage() {
  const [people, absences, studios] = await Promise.all([
    db.person.findMany({
      orderBy: { name: "asc" },
      include: {
        studios: { include: { studio: true } },
        _count: { select: { tasks: { where: { trashedAt: null, status: { not: "DELIVERED" } } } } },
      },
    }),
    db.absence.findMany({ orderBy: { startDate: "asc" }, include: { person: true } }),
    listStudios(),
  ]);

  return (
    <EquipeView
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        external: p.external,
        studios: p.studios,
        activeTaskCount: p._count.tasks,
      }))}
      absences={absences.map((a) => ({
        id: a.id,
        personName: a.person.name,
        startDate: a.startDate,
        endDate: a.endDate,
        reason: a.reason,
      }))}
      studios={studios}
    />
  );
}
