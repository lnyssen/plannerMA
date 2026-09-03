"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useRangeDrag } from "@/components/planning/use-range-drag";
import { useCreateModals } from "@/components/shell/create-modals-context";
import { textButtonClass } from "@/components/ui/buttons";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { addDays, formatShortFr, fromIsoDate, mondayOf, toIsoDate, today, type IsoDate } from "@/lib/planning/dates";
import { studioBarStyle } from "@/lib/planning/labels";

const JOUR_LABEL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

/** Ligne « Non attribué » : une vraie ligne de la grille, mais sans personne derrière. */
const UNASSIGNED_ROW = "__non_attribue__";

export interface WeekTask {
  id: string;
  title: string;
  assigneeId: string | null;
  studios: { studio: { id: string; name: string; fillHex: string; colorHex: string } }[];
  project: { name: string; client: { name: string } } | null;
  startDate: Date;
  endDate: Date;
}

export function SemaineView({
  monday,
  people,
  tasks,
}: {
  monday: IsoDate;
  people: { id: string; name: string }[];
  tasks: WeekTask[];
}) {
  const router = useRouter();
  const openCreate = useCreateModals();
  // Sur téléphone, la grille de cinq jours ne laissait voir qu'une colonne à
  // la fois derrière un défilement horizontal, sans rien pour dire qu'il
  // fallait faire glisser. On y choisit donc le jour, et il occupe toute la
  // largeur — même principe que le Kanban.
  const [jourMobile, setJourMobile] = useState(0);
  const [estMobile, setEstMobile] = useState(false);
  useEffect(() => {
    const check = () => setEstMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const days = Array.from({ length: 5 }, (_, i) => addDays(fromIsoDate(monday), i));
  const covers = (t: WeekTask, dayIso: string) => toIsoDate(t.startDate) <= dayIso && dayIso <= toIsoDate(t.endDate);
  // Un seul jour sur téléphone, les cinq sinon. `decalage` ramène l'index
  // affiché à l'index réel dans la semaine, dont dépendent les dates posées
  // par le glisser.
  const joursAffiches = estMobile ? [days[jourMobile]] : days;
  const decalage = estMobile ? jourMobile : 0;

  // Tirer sur les jours d'une ligne crée directement la tâche pour cette
  // personne sur ces dates : le geste porte déjà les trois informations
  // (qui, à partir de quand, jusqu'à quand), les redemander dans le
  // formulaire reviendrait à les saisir deux fois.
  const drag = useRangeDrag(
    useCallback(
      ({ rowKey, from, to }) => {
        openCreate("task", {
          assigneeId: rowKey === UNASSIGNED_ROW ? "" : rowKey,
          startDate: toIsoDate(days[from]),
          endDate: toIsoDate(days[to]),
        });
      },
      // `days` est recalculé à chaque rendu mais dépend uniquement de `monday`.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [openCreate, monday],
    ),
  );

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

      {/* Choix du jour — téléphone uniquement. */}
      <div className="mb-3 flex gap-1.5 sm:hidden">
        {days.map((d, i) => {
          const iso = toIsoDate(d);
          const actif = i === jourMobile;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setJourMobile(i)}
              aria-pressed={actif}
              className={`flex flex-1 flex-col items-center rounded-lg border-[1.5px] py-1.5 ${
                actif ? "border-heading bg-heading text-paper" : "border-line text-ink-muted"
              }`}
            >
              <span className="text-2xs font-semibold uppercase">{JOUR_LABEL[d.getUTCDay() - 1]?.slice(0, 3)}</span>
              <span className="text-sm font-bold tabular-nums">{d.getUTCDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid border-t border-l border-line"
          style={{
            gridTemplateColumns: `${estMobile ? 118 : 170}px repeat(${joursAffiches.length}, minmax(${estMobile ? 0 : 140}px,1fr))`,
            minWidth: estMobile ? undefined : 860,
          }}
        >
          <div className="border-r border-b border-line bg-wash" />
          {joursAffiches.map((d) => {
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
              rowKey={p.id}
              name={p.name}
              days={joursAffiches}
              decalage={decalage}
              tasks={tasks.filter((t) => t.assigneeId === p.id)}
              covers={covers}
              drag={drag}
              onOpenTask={(id) => router.push(`/taches/${id}`)}
            />
          ))}
          <PersonRow
            rowKey={UNASSIGNED_ROW}
            name="Non attribué"
            days={joursAffiches}
            decalage={decalage}
            tasks={tasks.filter((t) => !t.assigneeId)}
            covers={covers}
            drag={drag}
            onOpenTask={(id) => router.push(`/taches/${id}`)}
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        Double-cliquez une tâche pour l’ouvrir. Glissez sur les jours d’une ligne (ou cliquez une case vide) pour créer
        une tâche déjà attribuée à cette personne, sur ces dates.
      </p>
    </div>
  );
}

function PersonRow({
  rowKey,
  name,
  days,
  decalage,
  tasks,
  covers,
  drag,
  onOpenTask,
}: {
  rowKey: string;
  name: string;
  days: Date[];
  /** Index, dans la semaine complète, du premier jour affiché — voir joursAffiches. */
  decalage: number;
  tasks: WeekTask[];
  covers: (t: WeekTask, dayIso: string) => boolean;
  drag: ReturnType<typeof useRangeDrag>;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 border-r border-b border-line px-3 py-2.5 text-sm font-semibold text-ink">
        <PersonAvatar name={rowKey === UNASSIGNED_ROW ? null : name} size="md" />
        <span className="truncate">{name}</span>
      </div>
      {days.map((d, dayIndex) => {
        const iso = toIsoDate(d);
        const items = tasks.filter((t) => covers(t, iso));
        const overloaded = items.length > 2;
        const inSelection =
          drag.selection?.rowKey === rowKey &&
          decalage + dayIndex >= drag.selection.from &&
          decalage + dayIndex <= drag.selection.to;
        return (
          <div
            key={iso}
            {...drag.cellAttrs(rowKey, decalage + dayIndex)}
            onPointerDown={(e) => {
              // Le glissement ne part que du fond de la case : sur une barre
              // de tâche, le pointeur sert déjà à l'ouvrir.
              if ((e.target as HTMLElement).closest("button")) return;
              drag.start(rowKey, decalage + dayIndex);
            }}
            title={`Créer une tâche pour ${name} le ${formatShortFr(iso)} — glissez pour couvrir plusieurs jours`}
            className={`group relative flex min-h-[56px] cursor-cell touch-none flex-col gap-1 border-r border-b border-line p-1.5 transition-colors duration-75 ${
              inSelection ? "bg-tint" : ""
            }`}
          >
            {overloaded && (
              <span title="Plus de deux tâches ce jour" className="absolute top-1 right-1 h-1.5 w-1.5 bg-alert" />
            )}
            {/* Repère d'amorce : sans lui, rien n'indique que le fond d'une
                case vide est cliquable. */}
            {items.length === 0 && !inSelection && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-ink-muted opacity-0 transition-opacity duration-100 group-hover:opacity-45"
              >
                <Plus size={16} />
              </span>
            )}
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onDoubleClick={() => onOpenTask(t.id)}
                title={`${t.title} (double-clic pour les détails)`}
                className="cursor-pointer px-1.5 py-1 text-left outline-2 -outline-offset-2 outline-transparent transition-[outline-color] duration-100 hover:outline-current"
                style={studioBarStyle(t.studios)}
              >
                <div className="text-2xs font-semibold">{t.title}</div>
                {t.project && (
                  <div className="text-2xs opacity-85">
                    <strong className="font-bold">{t.project.client.name}</strong> — {t.project.name}
                  </div>
                )}
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}
