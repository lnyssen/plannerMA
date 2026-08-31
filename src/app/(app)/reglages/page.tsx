import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { listRecentJournalEntries } from "@/lib/data/journal";
import { listStudios } from "@/lib/data/studios";
import { listTaskCategories } from "@/lib/data/task-categories";
import { listTaskStatuses } from "@/lib/data/task-statuses";
import { ReglagesView } from "./reglages-view";

export default async function ReglagesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, statuses, categories, trashed, journal] = await Promise.all([
    listStudios(),
    listTaskStatuses(),
    listTaskCategories(),
    db.task.findMany({
      where: { trashedAt: { not: null } },
      orderBy: { trashedAt: "desc" },
      include: { project: true },
    }),
    listRecentJournalEntries(),
  ]);

  return (
    <ReglagesView
      studios={studios}
      statuses={statuses}
      categories={categories}
      trashedTasks={trashed.map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.project?.name ?? null,
        trashedAt: t.trashedAt,
      }))}
      journal={journal}
    />
  );
}
