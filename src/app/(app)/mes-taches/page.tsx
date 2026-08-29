import { PageHeader } from "@/components/ui/page-header";

export default function MesTachesPage() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Mes tâches" />
      <p className="text-sm text-ink-muted">
        Vue à venir (palier 6) : les tâches qui vous sont attribuées, triées par échéance.
      </p>
    </div>
  );
}
