"use client";

import { BarChart3, CalendarDays, Columns3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import type { GanttTask } from "@/lib/data/gantt";
import type { PersonSummary } from "@/lib/data/people";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskListItem } from "@/lib/data/tasks";
import type { IsoDate } from "@/lib/planning/dates";
import { GanttView } from "./gantt-view";
import { KanbanView } from "./kanban-view";
import { SemaineView, type WeekTask } from "./semaine-view";

export type PlanningTab = "kanban" | "semaine" | "gantt";

const TABS: SegmentedOption<PlanningTab>[] = [
  { id: "gantt", label: "Gantt", icon: BarChart3 },
  { id: "kanban", label: "Kanban", icon: Columns3 },
  { id: "semaine", label: "Semaine", icon: CalendarDays },
];

export function PlanningView({
  initialTab,
  monday,
  weekPeople,
  weekTasks,
  ganttTasks,
  boardTasks,
  studios,
  people,
  statuses,
}: {
  initialTab: PlanningTab;
  monday: IsoDate;
  weekPeople: { id: string; name: string }[];
  weekTasks: WeekTask[];
  ganttTasks: GanttTask[];
  boardTasks: TaskListItem[];
  studios: StudioSummary[];
  people: PersonSummary[];
  statuses: TaskStatusSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PlanningTab>(initialTab);
  // Resynchronise sur la valeur venue de l'URL (ex. la navigation de date de
  // Semaine, qui pousse elle-même `vue=semaine`) sans écraser un changement
  // d'onglet local plus récent — même principe que ailleurs dans l'appli
  // (Gantt : `syncedInitialTasks`) : ajustement pendant le rendu plutôt que
  // dans un effet.
  const [syncedInitialTab, setSyncedInitialTab] = useState(initialTab);
  if (initialTab !== syncedInitialTab) {
    setSyncedInitialTab(initialTab);
    setTab(initialTab);
  }

  function selectTab(next: PlanningTab) {
    setTab(next);
    router.push(`/planning?vue=${next}`);
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Planning
        </h1>
        <SegmentedControl ariaLabel="Vue du planning" value={tab} onChange={selectTab} options={TABS} />
      </div>

      {tab === "kanban" && <KanbanView tasks={boardTasks} studios={studios} people={people} statuses={statuses} />}
      {tab === "semaine" && <SemaineView monday={monday} people={weekPeople} tasks={weekTasks} />}
      {tab === "gantt" && <GanttView initialTasks={ganttTasks} />}
    </div>
  );
}
