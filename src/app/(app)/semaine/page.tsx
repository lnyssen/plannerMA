import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { addDays, formatShortFr, fromIsoDate, mondayOf, toIsoDate, today } from "@/lib/planning/dates";

const JOUR_LABEL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ debut?: string }>;
}) {
  const { debut } = await searchParams;
  const monday = debut ? mondayOf(fromIsoDate(debut)) : mondayOf(fromIsoDate(today()));
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  const rangeStart = toIsoDate(monday);
  const rangeEnd = toIsoDate(addDays(monday, 6));
  const prevWeek = toIsoDate(addDays(monday, -7));
  const nextWeek = toIsoDate(addDays(monday, 7));

  const [people, tasks] = await Promise.all([
    db.person.findMany({ orderBy: { name: "asc" } }),
    db.task.findMany({
      where: {
        trashedAt: null,
        startDate: { lte: fromIsoDate(rangeEnd) },
        endDate: { gte: fromIsoDate(rangeStart) },
      },
      include: { studio: true, project: true },
    }),
  ]);

  const covers = (t: { startDate: Date; endDate: Date }, dayIso: string) =>
    toIsoDate(t.startDate) <= dayIso && dayIso <= toIsoDate(t.endDate);

  return (
    <div className="px-8 py-8">
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Semaine
      </h1>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink">
          Semaine du {formatShortFr(rangeStart)} au {formatShortFr(toIsoDate(days[4]))}
        </p>
        <Link href={`/semaine?debut=${prevWeek}`} aria-label="Semaine précédente" className="text-heading">
          <ChevronLeft size={18} />
        </Link>
        <Link href={`/semaine?debut=${toIsoDate(mondayOf(fromIsoDate(today())))}`} className="text-sm font-semibold text-heading underline-offset-2 hover:underline">
          Aujourd’hui
        </Link>
        <Link href={`/semaine?debut=${nextWeek}`} aria-label="Semaine suivante" className="text-heading">
          <ChevronRight size={18} />
        </Link>
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
                <div className="font-[family-name:var(--font-display)] text-lg leading-6 font-semibold text-rail">
                  {d.getUTCDate()}
                </div>
              </div>
            );
          })}

          {people.map((p) => (
            <PersonRow key={p.id} name={p.name} days={days} tasks={tasks.filter((t) => t.assigneeId === p.id)} covers={covers} />
          ))}
          <PersonRow name="Non attribué" days={days} tasks={tasks.filter((t) => !t.assigneeId)} covers={covers} />
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  name,
  days,
  tasks,
  covers,
}: {
  name: string;
  days: Date[];
  tasks: Array<{
    id: string;
    title: string;
    studio: { name: string; fillHex: string; colorHex: string };
    project: { name: string } | null;
    startDate: Date;
    endDate: Date;
  }>;
  covers: (t: { startDate: Date; endDate: Date }, dayIso: string) => boolean;
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
              <span
                title="Plus de deux tâches ce jour"
                className="absolute top-1 right-1 h-1.5 w-1.5 bg-alert"
              />
            )}
            {items.map((t) => (
              <div key={t.id} className="px-1.5 py-1" style={{ background: t.studio.fillHex, color: t.studio.colorHex }}>
                <div className="text-2xs font-semibold">{t.title}</div>
                {t.project && <div className="text-2xs opacity-85">{t.project.name}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
