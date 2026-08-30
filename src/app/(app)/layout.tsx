import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { listClients } from "@/lib/data/clients";
import { listPeople } from "@/lib/data/people";
import { listActiveProjectsForForms } from "@/lib/data/projects";
import { listStudios } from "@/lib/data/studios";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, people, projects, clients] = await Promise.all([
    listStudios(),
    listPeople(),
    listActiveProjectsForForms(),
    listClients(),
  ]);

  return (
    <AppShell
      studios={studios}
      people={people}
      projects={projects}
      clients={clients}
      userName={session.user.name ?? session.user.email ?? "—"}
      role={session.user.role}
    >
      {children}
    </AppShell>
  );
}
