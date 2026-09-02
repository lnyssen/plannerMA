"use client";

import { AlertTriangle, CheckSquare, Clock, Square, Umbrella } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { stopTimer, type RunningTimer } from "@/lib/actions/time-entries";
import { dangerButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { StudioBadge } from "@/components/ui/studio-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { EntryContextLabelParts } from "@/components/ui/task-context-label";
import { formatLongFr, formatShortFr, today } from "@/lib/planning/dates";
import { entryDurationMinutes, formatDurationFr } from "@/lib/planning/time";

interface TodayTask {
  id: string;
  title: string;
  endDate: string;
  project: { name: string; client: { name: string } } | null;
  studios: { id: string; name: string; fillHex: string; colorHex: string }[];
  status: { name: string; fillHex: string; colorHex: string };
}

interface TodayAbsence {
  id: string;
  personId: string;
  personName: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  mine: boolean;
}

/**
 * Page d'accueil personnelle — remplace Projets comme destination par
 * défaut pour un compte non-admin (voir src/app/page.tsx) : ses tâches du
 * jour, son minuteur, ses absences (et celles de l'équipe) à venir, plutôt
 * qu'une vue d'ensemble pensée pour un admin.
 */
export function TodayView({
  userName,
  tasks,
  runningTimer,
  absences,
}: {
  userName: string;
  tasks: TodayTask[];
  runningTimer: RunningTimer;
  absences: TodayAbsence[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!runningTimer) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [runningTimer]);

  function handleStop() {
    if (!runningTimer) return;
    startTransition(async () => {
      await stopTimer(runningTimer.id);
      router.refresh();
    });
  }

  const todayIso = today();
  const myAbsence = absences.find((a) => a.mine && a.startDate <= todayIso && todayIso <= a.endDate);
  const myNextAbsence = absences.find((a) => a.mine && a.startDate > todayIso);
  const teamAbsences = absences.filter((a) => !a.mine).slice(0, 6);

  const firstName = userName.split(" ")[0];

  return (
    <div className="px-8 py-8">
      <h1 className="mb-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Bonjour {firstName}
      </h1>
      <p className="mb-6 text-sm text-ink-muted">{formatLongFr(todayIso)}</p>

      {myAbsence && (
        <p className="mb-6 flex items-center gap-2 rounded-lg border border-heading bg-wash px-3 py-2 text-sm text-heading">
          <Umbrella size={14} className="flex-shrink-0" /> Vous êtes absent·e aujourd’hui
          {myAbsence.endDate !== todayIso && <> jusqu’au {formatShortFr(myAbsence.endDate)}</>}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <SectionHeading count={tasks.length}>Tâches du jour</SectionHeading>
          {tasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Rien de planifié aujourd’hui" description="Profitez-en, ou consultez Mes tâches pour la suite." />
          ) : (
            <div className="flex flex-col gap-2">
              {tasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/taches/${t.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 transition-colors duration-100 hover:border-heading active:bg-wash"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-heading">{t.title}</p>
                    <p className="truncate text-2xs text-ink-muted">
                      {t.project ? `${t.project.client.name} — ${t.project.name}` : "Sans projet"}
                    </p>
                  </div>
                  {t.studios.map((s) => (
                    <StudioBadge key={s.id} name={s.name} fillHex={s.fillHex} colorHex={s.colorHex} />
                  ))}
                  <StatusBadge status={t.status} />
                  {t.endDate < todayIso && (
                    <span className="flex items-center gap-1 text-2xs font-semibold text-alert">
                      <AlertTriangle size={11} /> échéance dépassée
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <SectionHeading>Minuteur</SectionHeading>
            {runningTimer ? (
              <div className="rounded-lg border border-heading bg-wash p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-alert" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-heading">
                    <EntryContextLabelParts entry={runningTimer} />
                  </span>
                </div>
                <p className="mb-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-heading tabular-nums">
                  {formatDurationFr(entryDurationMinutes(runningTimer, now))}
                </p>
                <button
                  type="button"
                  onClick={handleStop}
                  className={`flex w-full items-center justify-center gap-1.5 py-1.5 text-sm font-semibold ${dangerButtonClass}`}
                >
                  <Square size={14} /> Arrêter
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-line p-3 text-center">
                <Clock size={18} className="mx-auto mb-2 text-ink-muted" aria-hidden="true" />
                <p className="mb-3 text-sm text-ink-muted">Aucun minuteur en cours.</p>
                <Link href="/temps" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}>
                  Démarrer sur Temps
                </Link>
              </div>
            )}
          </div>

          <div>
            <SectionHeading>Absences à venir (14 jours)</SectionHeading>
            {myNextAbsence && (
              <p className="mb-2 text-sm text-ink">
                Vous : {formatShortFr(myNextAbsence.startDate)} → {formatShortFr(myNextAbsence.endDate)}
              </p>
            )}
            {teamAbsences.length === 0 && !myNextAbsence ? (
              <p className="text-sm text-ink-muted">Personne d’absent dans les 14 prochains jours.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {teamAbsences.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <span className="truncate font-semibold text-heading">{a.personName}</span>
                    <span className="flex-shrink-0 text-2xs text-ink-muted tabular-nums">
                      {formatShortFr(a.startDate)} → {formatShortFr(a.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/equipe" className="mt-2 inline-block text-2xs font-semibold text-heading hover:underline">
              Voir le calendrier complet →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
