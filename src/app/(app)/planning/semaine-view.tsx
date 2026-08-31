"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TaskDetailModal } from "@/components/modals/task-detail-modal";
import { textButtonClass } from "@/components/ui/buttons";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskOption } from "@/lib/data/tasks";
import { addDays, formatShortFr, fromIsoDate, mondayOf, toIsoDate, today, type IsoDate } from "@/lib/planning/dates";

const JOUR_LABEL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export interface WeekTask {
  id: string;
  title: string;
  assigneeId: string | null;
  studio: { name: string; fillHex: string; colorHex: string };
  project: { name: string } | null;
  startDate: Date;
  endDate: Date;
}

export function SemaineView({
  monday,
  people,
  tasks,
  studios,
  projects,
  allPeople,
  statuses,
  dependencyOptions,
}: {
  monday: IsoDate;
  people: { id: string; name: string }[];
  tasks: WeekTask[];
  studios: StudioSummary[];
  projects: ProjectOption[];
  allPeople: PersonSummary[];
  statuses: TaskStatusSummary[];
  dependencyOptions: TaskOption[];
}) {
  const router = useRouter();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const days = Array.from({ length: 5 }, (_, i) => addDays(fromIsoDate(monday), i));
  const covers = (t: WeekTask, dayIso: string) => toIsoDate(t.startDate) <= dayIso && dayIso <= toIsoDate(t.endDate);

  function goTo(iso: IsoDate) {
    router.push(`/planning?vue=semaine&debut=${toIsoDate(mondayOf(fromIsoDate(iso)))}`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink">
          Semaine du {formatShortFr(monday)} au {formatShortFr(toIsoDate(days[4]))}
        </p>
        <input
          type="date"
          value={monday}
          onChange={(e) => e.target.value && goTo(e.target.value)}
          aria-label="Aller à une date"
          className="rounded-md border-[1.5px] border-heading px-2 py-1 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => goTo(toIsoDate(addDays(fromIsoDate(monday), -7)))}
          aria-label="Semaine précédente"
          className={`p-1 text-heading ${textButtonClass}`}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => goTo(today())}
          className={`text-sm font-semibold text-heading underline-offset-2 hover:underline ${textButtonClass}`}
        >
          Aujourd’hui
        </button>
        <button
          type="button"
          onClick={() => goTo(toIsoDate(addDays(fromIsoDate(monday), 7)))}
          aria-label="Semaine suivante"
          className={`p-1 text-heading ${textButtonClass}`}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid border-t border-l border-line"
          style={{ gridTemplateColumns: `170px repeat(5, minmax(140px,1fr))`, minWidth: 860 }}
        >
          <div className="border-r border-b border-line bg-wash" />
          {days.map((d) => {
            const iso = toIsoDate(d);
            return (
              <div key={iso} className="border-r border-b border-line bg-wash px-3 py-2.5">
                <div className="font-[family-name:var(--font-display)] text-sm font-medium tracking-[-0.1px] text-heading">
                  {JOUR_LABEL[d.getUTCDay() - 1]}
                </div>
                <div className="font-[family-name:var(--font-display)] text-lg leading-6 font-semibold text-heading">
                  {d.getUTCDate()}
                </div>
              </div>
            );
          })}

          {people.map((p) => (
            <PersonRow
              key={p.id}
              name={p.name}
              days={days}
              tasks={tasks.filter((t) => t.assigneeId === p.id)}
              covers={covers}
              onOpenTask={setOpenTaskId}
            />
          ))}
          <PersonRow
            name="Non attribué"
            days={days}
            tasks={tasks.filter((t) => !t.assigneeId)}
            covers={covers}
            onOpenTask={setOpenTaskId}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted">Double-cliquez une tâche pour l’ouvrir.</p>

      {openTaskId && (
        <TaskDetailModal
          taskId={openTaskId}
          studios={studios}
          projects={projects}
          people={allPeople}
          statuses={statuses}
          tasks={dependencyOptions}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}

function PersonRow({
  name,
  days,
  tasks,
  covers,
  onOpenTask,
}: {
  name: string;
  days: Date[];
  tasks: WeekTask[];
  covers: (t: WeekTask, dayIso: string) => boolean;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <>
      <div className="flex items-center border-r border-b border-line px-3 py-2.5 text-sm font-semibold text-ink">
        {name}
      </div>
      {days.map((d) => {
        const iso = toIsoDate(d);
        const items = tasks.filter((t) => covers(t, iso));
        const overloaded = items.length > 2;
        return (
          <div key={iso} className="relative flex min-h-[56px] flex-col gap-1 border-r border-b border-line p-1.5">
            {overloaded && (
              <span title="Plus de deux tâches ce jour" className="absolute top-1 right-1 h-1.5 w-1.5 bg-alert" />
            )}
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onDoubleClick={() => onOpenTask(t.id)}
                title={`${t.title} (double-clic pour les détails)`}
                className="cursor-pointer px-1.5 py-1 text-left outline-2 -outline-offset-2 outline-transparent transition-[outline-color] duration-100 hover:outline-current"
                style={{ background: t.studio.fillHex, color: t.studio.colorHex }}
              >
                <div className="text-2xs font-semibold">{t.title}</div>
                {t.project && <div className="text-2xs opacity-85">{t.project.name}</div>}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}
