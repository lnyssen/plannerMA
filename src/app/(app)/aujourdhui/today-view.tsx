"use client";

import { CheckSquare, Play, Square, Umbrella } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { startTimer, stopTimer, type RunningTimer } from "@/lib/actions/time-entries";
import { dangerButtonClass } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { StudioBadge } from "@/components/ui/studio-badge";
import { EntryContextLabelParts } from "@/components/ui/task-context-label";
import { formatLongFr, formatShortFr, today } from "@/lib/planning/dates";
import { entryDurationMinutes, formatDurationFr } from "@/lib/planning/time";

interface TodayTask {
  id: string;
  title: string;
  startDate: string;
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
 * Une tâche de la journée.
 *
 * Elle portait cinq informations — titre, projet, studios, statut, date — sur
 * un écran qui répond « que faire maintenant ». Le statut y est implicite :
 * une tâche qu'on vous montre ici est à faire ou en cours, la pastille ne
 * discriminait rien. Elle reste sur Tâches et sur la fiche, où elle varie.
 *
 * Le retard se disait cinq fois sur la même ligne : bordure rouge, fond
 * rouge, date rouge, icône dans le titre de section, compteur à côté. Il en
 * reste deux, qui ne disent pas la même chose — un filet à gauche pour
 * l'état, la date en rouge pour l'échéance manquée. C'est le filet déjà
 * utilisé par les notifications non lues : une grammaire réemployée plutôt
 * qu'une de plus.
 */
function TaskRow({
  task,
  late = false,
  showStart = false,
  onStart,
  starting,
}: {
  task: TodayTask;
  late?: boolean;
  showStart?: boolean;
  onStart?: (task: TodayTask) => void;
  starting?: boolean;
}) {
  return (
    <div
      className="group flex items-center gap-3 rounded-lg border border-l-[3px] border-line py-2.5 pr-2.5 pl-3 transition-colors duration-100 hover:border-heading"
      style={late ? { borderLeftColor: "var(--color-alert)" } : undefined}
    >
      <Link href={`/taches/${task.id}`} className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-heading">{task.title}</span>
        <span className="truncate text-2xs text-ink-muted">
          {task.project ? `${task.project.client.name} — ${task.project.name}` : "Sans projet"}
        </span>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-1.5">
        {task.studios.map((s) => (
          <StudioBadge key={s.id} name={s.name} fillHex={s.fillHex} colorHex={s.colorHex} />
        ))}
        <span
          className="w-[7.5rem] text-right text-2xs tabular-nums"
          style={late ? { color: "var(--color-alert)", fontWeight: 600 } : { color: "var(--color-ink-muted)" }}
        >
          {showStart ? `dès le ${formatShortFr(task.startDate)}` : `échéance ${formatShortFr(task.endDate)}`}
        </span>

        {/* L'action de cet écran, c'est de s'y mettre. Elle était déportée
            dans Temps ; elle est ici, sur la tâche. Discrète tant qu'on ne
            survole pas — et toujours visible au clavier. */}
        {onStart && task.studios.length > 0 ? (
          <button
            type="button"
            onClick={() => onStart(task)}
            disabled={starting}
            aria-label={`Démarrer le minuteur sur « ${task.title} »`}
            title="Démarrer le minuteur"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-muted opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100 hover:text-heading disabled:opacity-40"
          >
            <Play size={14} />
          </button>
        ) : (
          <span className="h-7 w-7 flex-shrink-0" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

/** Séparateur de bande : une bascule dans le temps, pas une section à part. */
function Bande({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 mb-2 text-2xs font-semibold tracking-wide text-ink-muted uppercase first:mt-0">{children}</p>
  );
}

/**
 * Page d'accueil personnelle — remplace Projets comme destination par
 * défaut pour un compte non-admin (voir src/app/page.tsx) : ses tâches du
 * jour, son minuteur, ses absences (et celles de l'équipe) à venir, plutôt
 * qu'une vue d'ensemble pensée pour un admin.
 */
export function TodayView({
  lateTasks,
  tasks,
  soonTasks,
  runningTimer,
  absences,
}: {
  lateTasks: TodayTask[];
  tasks: TodayTask[];
  soonTasks: TodayTask[];
  runningTimer: RunningTimer;
  absences: TodayAbsence[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runningTimer) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [runningTimer]);

  const [starting, setStarting] = useState<string | null>(null);
  function handleStart(task: TodayTask) {
    setStarting(task.id);
    startTransition(async () => {
      // Le studio vient de la tâche : sur cet écran on démarre sur ce qui est
      // déjà planifié, il n'y a rien à choisir.
      const r = await startTimer({ taskId: task.id, studioId: task.studios[0].id });
      setStarting(null);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

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
  const aucuneTache = lateTasks.length === 0 && tasks.length === 0 && soonTasks.length === 0;

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      {/* Le titre nomme l'écran, comme partout ailleurs. « Bonjour Laurent »
          occupait la position la plus forte de la page — le plus gros
          caractère, en haut — pour n'y rien dire. */}
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        Aujourd’hui
      </h1>
      <p className="mb-6 text-sm text-ink-muted">{formatLongFr(todayIso)}</p>

      {myAbsence && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-wash px-3 py-2 text-sm text-ink">
          <Umbrella size={14} className="flex-shrink-0 text-heading" /> Vous êtes absent·e aujourd’hui
          {myAbsence.endDate !== todayIso && <> jusqu’au {formatShortFr(myAbsence.endDate)}</>}.
        </p>
      )}

      {/* Un minuteur qui tourne est un état, pas une action : il ne s'affiche
          que s'il tourne. La carte « Aucun minuteur en cours », avec son
          bouton qui renvoyait vers Temps, a disparu — on démarre désormais
          depuis la tâche elle-même. */}
      {runningTimer && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-heading bg-wash px-3 py-2.5">
          <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-alert" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-heading">
            <EntryContextLabelParts entry={runningTimer} />
          </span>
          <span className="flex-shrink-0 font-[family-name:var(--font-display)] text-lg font-semibold text-heading tabular-nums">
            {formatDurationFr(entryDurationMinutes(runningTimer, now))}
          </span>
          <button
            type="button"
            onClick={handleStop}
            className={`flex flex-shrink-0 items-center gap-1.5 px-3 py-1 text-sm font-semibold ${dangerButtonClass}`}
          >
            <Square size={13} /> Arrêter
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}

      {/* Une seule liste, ordonnée. C'étaient trois sections avec leurs
          titres, leurs états vides et leur quatrième état vide global, pour
          présenter la même chose : vos tâches, triées par date. Les bandes
          restent — elles portent une information — mais en séparateurs. */}
      {aucuneTache ? (
        <EmptyState
          icon={CheckSquare}
          title="Rien ne vous attend"
          description="Aucune tâche en retard, aujourd’hui, ni dans les sept prochains jours."
        />
      ) : (
        <div className="max-w-4xl">
          {lateTasks.length > 0 && (
            <>
              <Bande>
                <span style={{ color: "var(--color-alert)" }}>En retard · {lateTasks.length}</span>
              </Bande>
              <div className="flex flex-col gap-1.5">
                {lateTasks.map((t) => (
                  <TaskRow key={t.id} task={t} late onStart={handleStart} starting={starting === t.id} />
                ))}
              </div>
            </>
          )}

          {tasks.length > 0 && (
            <>
              <Bande>Aujourd’hui · {tasks.length}</Bande>
              <div className="flex flex-col gap-1.5">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onStart={handleStart} starting={starting === t.id} />
                ))}
              </div>
            </>
          )}

          {soonTasks.length > 0 && (
            <>
              <Bande>Dans les sept jours · {soonTasks.length}</Bande>
              <div className="flex flex-col gap-1.5">
                {soonTasks.map((t) => (
                  <TaskRow key={t.id} task={t} showStart onStart={handleStart} starting={starting === t.id} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Les absences sont du contexte d'équipe, pas une réponse à « que
          faire maintenant » : elles descendent en pied de page. Reléguées,
          pas supprimées — savoir qui est joignable a sa valeur le matin. */}
      {(myNextAbsence || teamAbsences.length > 0) && (
        <div className="mt-10 max-w-4xl border-t border-line pt-4">
          <p className="mb-2 text-2xs font-semibold tracking-wide text-ink-muted uppercase">
            Absences à venir
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-ink-muted">
            {myNextAbsence && (
              <span>
                <strong className="font-semibold text-ink">Vous</strong> {formatShortFr(myNextAbsence.startDate)} →{" "}
                {formatShortFr(myNextAbsence.endDate)}
              </span>
            )}
            {teamAbsences.map((a) => (
              <span key={a.id}>
                <strong className="font-semibold text-ink">{a.personName}</strong> {formatShortFr(a.startDate)} →{" "}
                {formatShortFr(a.endDate)}
              </span>
            ))}
            <Link href="/equipe" className="font-semibold text-heading hover:underline">
              Calendrier complet →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
