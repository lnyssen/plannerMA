import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { db } from "@/lib/db";
import { listStudios } from "@/lib/data/studios";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion"); // filet de sécurité, le middleware couvre déjà ce cas

  const [studios, pendingRequestsCount] = await Promise.all([
    listStudios(),
    db.request.count(),
  ]);

  return (
    <AppShell
      studios={studios}
      userName={session.user.name ?? session.user.email ?? "—"}
      role={session.user.role}
      pendingRequestsCount={pendingRequestsCount}
    >
      {children}
    </AppShell>
  );
}
