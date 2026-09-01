import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listStudios } from "@/lib/data/studios";
import { EquipeView } from "./equipe-view";

export default async function EquipePage() {
  const [session, people, absences, studios] = await Promise.all([
    auth(),
    db.person.findMany({
      orderBy: { name: "asc" },
      include: {
        studios: { include: { studio: true } },
        _count: { select: { tasks: { where: { trashedAt: null, status: { isNot: { isDone: true } } } } } },
      },
    }),
    db.absence.findMany({ orderBy: { startDate: "asc" }, include: { person: true } }),
    listStudios(),
  ]);

  const isAdmin = session?.user.role === "ADMIN";
  const currentPersonId = session?.user.personId ?? null;

  return (
    <EquipeView
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        external: p.external,
        active: p.active,
        studios: p.studios,
        activeTaskCount: p._count.tasks,
      }))}
      absences={absences.map((a) => ({
        id: a.id,
        personId: a.personId,
        personName: a.person.name,
        startDate: a.startDate,
        endDate: a.endDate,
        // Le motif est une donnée personnelle : visible pour un admin ou pour
        // sa propre absence, retiré côté serveur sinon — pas seulement caché
        // côté interface (même règle que le temps par personne sur une
        // fiche tâche/projet, voir getTaskDetail/getProjectDetail). Les
        // dates elles-mêmes restent visibles à tous : c'est le calendrier de
        // coordination d'équipe, son intérêt est justement d'être partagé.
        reason: isAdmin || a.personId === currentPersonId ? a.reason : null,
      }))}
      studios={studios}
      isAdmin={isAdmin}
      currentPersonId={currentPersonId}
    />
  );
}
