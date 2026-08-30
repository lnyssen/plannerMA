import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listStudios } from "@/lib/data/studios";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { ReglagesView } from "./reglages-view";

export default async function ReglagesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, statuses, trashed] = await Promise.all([
    listStudios(),
    listTaskStatuses(),
    db.task.findMany({
      where: { trashedAt: { not: null } },
      orderBy: { trashedAt: "desc" },
      include: { project: true },
    }),
  ]);

  return (
    <ReglagesView
      studios={studios}
      statuses={statuses}
      trashedTasks={trashed.map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.project?.name ?? null,
        trashedAt: t.trashedAt,
      }))}
    />
  );
}
