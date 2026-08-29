import { PageHeader } from "@/components/ui/page-header";

export default function PlanningPage() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Planning" />
      <p className="text-sm text-ink-muted">
        Vue à venir (palier 4) : Gantt, Semaine et Charge.
      </p>
    </div>
  );
}
