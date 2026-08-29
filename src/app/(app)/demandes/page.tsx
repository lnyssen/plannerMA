import { PageHeader } from "@/components/ui/page-header";

export default function DemandesPage() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Demandes" />
      <p className="text-sm text-ink-muted">
        Vue à venir (palier 6) : demandes non planifiées, convertibles en tâche.
      </p>
    </div>
  );
}
