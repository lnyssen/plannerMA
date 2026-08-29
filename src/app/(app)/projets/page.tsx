import { PageHeader } from "@/components/ui/page-header";

export default function ProjetsPage() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Projets" />
      <p className="text-sm text-ink-muted">
        Vue à venir (palier 3) : projets et tâches en groupes repliables, édition en place.
      </p>
    </div>
  );
}
