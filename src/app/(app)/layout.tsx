import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { listClients } from "@/lib/data/clients";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, people, projects, clients, account] = await Promise.all([
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listClients(),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { notifyOnAssignment: true, notifyDailyDigest: true },
    }),
  ]);

  return (
    <AppShell
      studios={studios}
      people={people}
      projects={projects}
      clients={clients}
      userName={session.user.name ?? session.user.email ?? "—"}
      role={session.user.role}
      notifyOnAssignment={account?.notifyOnAssignment ?? true}
      notifyDailyDigest={account?.notifyDailyDigest ?? true}
    >
      {children}
    </AppShell>
  );
}
