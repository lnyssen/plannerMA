import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listClients } from "@/lib/data/clients";
import { listStudios } from "@/lib/data/studios";
import { ReglagesView } from "./reglages-view";

export default async function ReglagesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, clients, trashed] = await Promise.all([
    listStudios(),
    listClients(),
    db.task.findMany({
      where: { trashedAt: { not: null } },
      orderBy: { trashedAt: "desc" },
      include: { project: true },
    }),
  ]);

  return (
    <ReglagesView
      studios={studios}
      clients={clients}
      trashedTasks={trashed.map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.project?.name ?? null,
        trashedAt: t.trashedAt,
      }))}
    />
  );
}
