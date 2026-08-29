import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReglagesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/projets"); // filet de sécurité, le middleware couvre déjà ce cas

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Réglages" />
      <p className="text-sm text-ink-muted">
        Vue à venir (palier 6) : studios, corbeille, journal, sauvegarde.
      </p>
    </div>
  );
}
