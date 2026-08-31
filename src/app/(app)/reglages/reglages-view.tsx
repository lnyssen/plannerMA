"use client";

import { ChevronDown, ChevronUp, Mail, Plus, RefreshCw, ScrollText, Settings, Tags, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendDailyDigestNow } from "@/lib/actions/account";
import { createStudio, renameStudio } from "@/lib/actions/studios";
import {
  countTaskCategoryUsage,
  createTaskCategory,
  deleteTaskCategory,
  moveTaskCategory,
  renameTaskCategory,
} from "@/lib/actions/task-categories";
import {
  createTaskStatus,
  deleteTaskStatus,
  moveTaskStatus,
  renameTaskStatus,
  setTaskStatusDone,
} from "@/lib/actions/task-statuses";
import { destroyTask, restoreTask } from "@/lib/actions/tasks";
import type { JournalEntrySummary } from "@/lib/data/journal";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskCategoryOption } from "@/lib/data/task-categories";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import { quandFr } from "@/lib/planning/dates";
import { fieldInputClass } from "@/components/modals/modal-shell";
import {
  dangerOutlineButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui/buttons";

interface TrashedTask {
  id: string;
  title: string;
  projectName: string | null;
  trashedAt: Date | null;
}

export function ReglagesView({
  studios,
  statuses,
  categories,
  trashedTasks,
  journal,
}: {
  studios: StudioSummary[];
  statuses: TaskStatusSummary[];
  categories: TaskCategoryOption[];
  trashedTasks: TrashedTask[];
  journal: JournalEntrySummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "categories" | "corbeille" | "journal">("general");
  const [, startTransition] = useTransition();
  const [newStudioName, setNewStudioName] = useState("");
  const [newStatusName, setNewStatusName] = useState("");
  const [digestResult, setDigestResult] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Clé "general" ou l'id du studio — un brouillon de nouvelle catégorie par groupe.
  const [newCategoryNames, setNewCategoryNames] = useState<Record<string, string>>({});
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const TABS = [
    { id: "general" as const, label: "Général", icon: Settings },
    { id: "categories" as const, label: "Catégories de tâches", icon: Tags },
    { id: "corbeille" as const, label: `Corbeille${trashedTasks.length ? ` (${trashedTasks.length})` : ""}`, icon: Trash2 },
    { id: "journal" as const, label: "Journal", icon: ScrollText },
  ];

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Réglages
        </h1>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${
                tab === t.id ? primaryButtonClass : secondaryButtonClass
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "general" && (
        <div className="max-w-lg">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">Notifications</h2>
          <p className="mb-3 text-sm text-ink">
            Le récap quotidien part normalement via le planificateur programmé (voir README) ; ce bouton l’envoie
            immédiatement, pour vérifier que l’envoi fonctionne.
          </p>
          <button
            type="button"
            onClick={() => {
              setDigestResult(null);
              startTransition(async () => {
                const result = await sendDailyDigestNow();
                setDigestResult(
                  result.error ? result.error : `Envoyé à ${result.sent} personne(s), ${result.skipped} sans tâche cette semaine.`,
                );
              });
            }}
            className={`mb-2 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
          >
            <Mail size={14} /> Envoyer le récap maintenant (test)
          </button>
          {digestResult && <p className="mb-6 text-xs text-ink-muted">{digestResult}</p>}

          <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">Studios</h2>
          <p className="mb-4 text-sm text-ink">
            Les couleurs viennent de l’identité visuelle réelle (voir docs/design-system.md) et ne se modifient pas
            ici — seul le nom est éditable. Un nouveau studio démarre avec une couleur neutre, à corriger avant tout
            usage réel.
          </p>
          <div className="mb-4 flex flex-col gap-2">
            {studios.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-xs font-bold"
                  style={{ background: s.fillHex, color: s.colorHex }}
                >
                  {s.initial}
                </span>
                <input
                  defaultValue={s.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== s.name) {
                      startTransition(async () => {
                        await renameStudio(s.id, value);
                        router.refresh();
                      });
                    }
                  }}
                  className={`${fieldInputClass} max-w-xs`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newStudioName}
              onChange={(e) => setNewStudioName(e.target.value)}
              placeholder="Nouveau studio"
              className={`${fieldInputClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={() => {
                if (!newStudioName.trim()) return;
                startTransition(async () => {
                  await createStudio(newStudioName.trim());
                  setNewStudioName("");
                  router.refresh();
                });
              }}
              className={`flex items-center gap-1.5 px-3 text-sm font-semibold ${secondaryButtonClass}`}
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>

          <h2 className="mt-8 mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">Statuts</h2>
          <p className="mb-4 text-sm text-ink">
            Les colonnes du Kanban et l’état d’une tâche — dans l’ordre ci-dessous. « Terminé » compte la tâche à
            100 % d’avancement et la sort du calcul de charge (Charge) ; comme pour les studios, un nouveau statut
            démarre avec une couleur neutre à corriger.
          </p>
          <div className="mb-4 flex flex-col gap-2">
            {statuses.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() =>
                      startTransition(async () => {
                        await moveTaskStatus(s.id, "up");
                        router.refresh();
                      })
                    }
                    aria-label={`Monter « ${s.name} »`}
                    className={`text-ink-muted disabled:opacity-30 ${textButtonClass}`}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={i === statuses.length - 1}
                    onClick={() =>
                      startTransition(async () => {
                        await moveTaskStatus(s.id, "down");
                        router.refresh();
                      })
                    }
                    aria-label={`Descendre « ${s.name} »`}
                    className={`text-ink-muted disabled:opacity-30 ${textButtonClass}`}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-xs font-bold"
                  style={{ background: s.fillHex, color: s.colorHex }}
                >
                  {s.name[0]?.toUpperCase()}
                </span>
                <input
                  defaultValue={s.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== s.name) {
                      startTransition(async () => {
                        await renameTaskStatus(s.id, value);
                        router.refresh();
                      });
                    }
                  }}
                  className={`${fieldInputClass} max-w-xs`}
                />
                <label className="flex items-center gap-1.5 text-xs text-ink">
                  <input
                    type="checkbox"
                    defaultChecked={s.isDone}
                    onChange={(e) =>
                      startTransition(async () => {
                        await setTaskStatusDone(s.id, e.target.checked);
                        router.refresh();
                      })
                    }
                  />
                  Terminé
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Supprimer le statut « ${s.name} » ?`)) return;
                    setStatusError(null);
                    startTransition(async () => {
                      const result = await deleteTaskStatus(s.id);
                      if (result.error) setStatusError(result.error);
                      router.refresh();
                    });
                  }}
                  aria-label={`Supprimer « ${s.name} »`}
                  className={`flex-shrink-0 p-1 text-ink-muted hover:text-alert ${textButtonClass}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          {statusError && <p className="mb-3 text-xs font-semibold text-alert">{statusError}</p>}
          <div className="flex gap-2">
            <input
              value={newStatusName}
              onChange={(e) => setNewStatusName(e.target.value)}
              placeholder="Nouveau statut"
              className={`${fieldInputClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={() => {
                if (!newStatusName.trim()) return;
                startTransition(async () => {
                  await createTaskStatus(newStatusName.trim());
                  setNewStatusName("");
                  router.refresh();
                });
              }}
              className={`flex items-center gap-1.5 px-3 text-sm font-semibold ${secondaryButtonClass}`}
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
        </div>
      )}

      {tab === "categories" && (
        <div>
          <p className="mb-4 max-w-2xl text-sm text-ink">
            Le « type de tâche » à choisir en enregistrant du temps (minuteur, saisie manuelle, calendrier) —
            nomenclature transmise par l’équipe. Les catégories générales sont proposées pour tous les studios ;
            chaque studio peut avoir en plus les siennes.
          </p>
          {categoryError && <p className="mb-3 text-xs font-semibold text-alert">{categoryError}</p>}
          <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            <CategoryGroup
              title="Général (tous studios)"
              studioId={null}
              categories={categories.filter((c) => c.studioId === null)}
              newName={newCategoryNames.general ?? ""}
              onNewNameChange={(v) => setNewCategoryNames((n) => ({ ...n, general: v }))}
              onError={setCategoryError}
              router={router}
              startTransition={startTransition}
            />
            {studios.map((s) => (
              <CategoryGroup
                key={s.id}
                title={s.name}
                studioId={s.id}
                categories={categories.filter((c) => c.studioId === s.id)}
                newName={newCategoryNames[s.id] ?? ""}
                onNewNameChange={(v) => setNewCategoryNames((n) => ({ ...n, [s.id]: v }))}
                onError={setCategoryError}
                router={router}
                startTransition={startTransition}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "corbeille" && (
        <div className="max-w-2xl">
          {trashedTasks.length === 0 && <p className="text-sm text-ink-muted">La corbeille est vide.</p>}
          <div className="flex flex-col gap-2">
            {trashedTasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
                <span className="min-w-[160px] flex-1 text-sm font-semibold text-heading">{t.title}</span>
                <span className="text-xs text-ink-muted">{t.trashedAt ? quandFr(t.trashedAt) : ""}</span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await restoreTask(t.id);
                      router.refresh();
                    })
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
                >
                  <RefreshCw size={13} /> Restaurer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Supprimer définitivement « ${t.title} » ? C’est irréversible.`)) return;
                    startTransition(async () => {
                      await destroyTask(t.id);
                      router.refresh();
                    });
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${dangerOutlineButtonClass}`}
                >
                  <Trash2 size={13} /> Détruire
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "journal" && (
        <div className="max-w-2xl">
          <p className="mb-4 text-sm text-ink-muted">Les 100 dernières écritures, tous types confondus.</p>
          {journal.length === 0 ? (
            <p className="text-sm text-ink-muted">Aucune écriture pour l’instant.</p>
          ) : (
            <div className="flex flex-col">
              {journal.map((entry) => (
                <div key={entry.id} className="flex items-baseline gap-2 border-b border-line py-2 text-sm">
                  {entry.task ? (
                    <a
                      href={`/taches?open=${entry.task.id}`}
                      className="text-ink underline-offset-2 hover:underline"
                    >
                      {entry.action}
                    </a>
                  ) : (
                    <span className="text-ink">{entry.action}</span>
                  )}
                  <span className="flex-shrink-0 text-xs text-ink-muted">
                    {entry.actorName}, {quandFr(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Un groupe de catégories (général, ou un studio) avec réorganisation/renommage/suppression — voir la section Statuts pour le même patron. */
function CategoryGroup({
  title,
  studioId,
  categories,
  newName,
  onNewNameChange,
  onError,
  router,
  startTransition,
}: {
  title: string;
  studioId: string | null;
  categories: TaskCategoryOption[];
  newName: string;
  onNewNameChange: (value: string) => void;
  onError: (message: string | null) => void;
  router: { refresh: () => void };
  startTransition: (callback: () => void) => void;
}) {
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold text-ink">{title}</h3>
      {categories.length === 0 && <p className="mb-2 text-xs text-ink-muted">Aucune catégorie.</p>}
      <div className="mb-2 flex flex-col gap-1.5">
        {categories.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button
                type="button"
                disabled={i === 0}
                onClick={() =>
                  startTransition(async () => {
                    await moveTaskCategory(c.id, "up");
                    router.refresh();
                  })
                }
                aria-label={`Monter « ${c.name} »`}
                className={`text-ink-muted disabled:opacity-30 ${textButtonClass}`}
              >
                <ChevronUp size={13} />
              </button>
              <button
                type="button"
                disabled={i === categories.length - 1}
                onClick={() =>
                  startTransition(async () => {
                    await moveTaskCategory(c.id, "down");
                    router.refresh();
                  })
                }
                aria-label={`Descendre « ${c.name} »`}
                className={`text-ink-muted disabled:opacity-30 ${textButtonClass}`}
              >
                <ChevronDown size={13} />
              </button>
            </div>
            <input
              defaultValue={c.name}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value && value !== c.name) {
                  startTransition(async () => {
                    await renameTaskCategory(c.id, value);
                    router.refresh();
                  });
                }
              }}
              className={`${fieldInputClass} max-w-xs text-sm`}
            />
            <button
              type="button"
              onClick={async () => {
                const usage = await countTaskCategoryUsage(c.id);
                const message =
                  usage > 0
                    ? `Supprimer la catégorie « ${c.name} » ? ${usage} écriture${usage > 1 ? "s" : ""} de temps perdra${usage > 1 ? "ont" : ""} ce classement.`
                    : `Supprimer la catégorie « ${c.name} » ?`;
                if (!confirm(message)) return;
                onError(null);
                startTransition(async () => {
                  const result = await deleteTaskCategory(c.id);
                  if (result.error) onError(result.error);
                  router.refresh();
                });
              }}
              aria-label={`Supprimer « ${c.name} »`}
              className={`flex-shrink-0 p-1 text-ink-muted hover:text-alert ${textButtonClass}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => onNewNameChange(e.target.value)}
          placeholder="Nouvelle catégorie"
          className={`${fieldInputClass} max-w-xs text-sm`}
        />
        <button
          type="button"
          onClick={() => {
            if (!newName.trim()) return;
            onError(null);
            startTransition(async () => {
              const result = await createTaskCategory(newName.trim(), studioId);
              if (result.error) {
                onError(result.error);
                return;
              }
              onNewNameChange("");
              router.refresh();
            });
          }}
          className={`flex items-center gap-1.5 px-3 text-sm font-semibold ${secondaryButtonClass}`}
        >
          <Plus size={13} /> Ajouter
        </button>
      </div>
    </div>
  );
}
