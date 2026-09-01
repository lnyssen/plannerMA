"use client";

import { AlertTriangle, AtSign, Copy, ExternalLink, History, ListChecks, MessageSquare, Paperclip, Plus, RotateCcw, Square, Timer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addLinkAttachment, deleteAttachment, uploadFileAttachment } from "@/lib/actions/attachments";
import { addComment } from "@/lib/actions/comments";
import { addSubtask, deleteSubtask, toggleSubtask } from "@/lib/actions/subtasks";
import { duplicateTask, getTaskDetail, restoreTask, trashTask, updateTask, type TaskDetail } from "@/lib/actions/tasks";
import { addManualEntry, deleteTimeEntry, startTimer, stopTimer } from "@/lib/actions/time-entries";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskStatusSummary } from "@/lib/data/task-statuses";
import type { TaskOption } from "@/lib/data/tasks";
import { formatFileSize } from "@/lib/format";
import { quandFr, toIsoDate, today } from "@/lib/planning/dates";
import { entryDurationMinutes, formatDurationFr, sumDurationMinutes } from "@/lib/planning/time";
import { recordRecentItem } from "@/lib/recent-items";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SearchField } from "@/components/ui/search-field";
import { fieldInputClass, FieldSection } from "@/components/modals/modal-shell";
import { TaskFormFields, type TaskFormValues } from "@/components/modals/task-form-fields";

export function TaskDetailView({
  initialTask,
  studios,
  projects,
  people,
  statuses,
  tasks = [],
}: {
  initialTask: TaskDetail;
  studios: StudioSummary[];
  projects: ProjectOption[];
  people: PersonSummary[];
  statuses: TaskStatusSummary[];
  tasks?: TaskOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [task, setTask] = useState<TaskDetail>(initialTask);
  const [values, setValues] = useState<TaskFormValues>({
    title: initialTask.title,
    description: initialTask.description ?? "",
    studioId: initialTask.studioId,
    projectId: initialTask.projectId ?? "",
    assigneeId: initialTask.assigneeId ?? "",
    startDate: toIsoDate(initialTask.startDate),
    endDate: toIsoDate(initialTask.endDate),
    maxDurationDays: initialTask.maxDurationDays != null ? String(initialTask.maxDurationDays) : "",
    statusId: initialTask.statusId,
    dependsOnId: initialTask.dependsOnId ?? "",
    estimatedHalfDays: initialTask.estimatedHalfDays != null ? String(initialTask.estimatedHalfDays) : "",
    recurrenceFrequency: initialTask.recurrenceFrequency ?? "",
    recurrenceInterval: initialTask.recurrenceInterval != null ? String(initialTask.recurrenceInterval) : "1",
    recurrenceUntil: initialTask.recurrenceUntil ? toIsoDate(initialTask.recurrenceUntil) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachmentSearch, setAttachmentSearch] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDue, setNewSubtaskDue] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [showManualTime, setShowManualTime] = useState(false);
  const [manualDate, setManualDate] = useState(today());
  const [manualHours, setManualHours] = useState("0");
  const [manualMinutes, setManualMinutes] = useState("30");

  // Alimente "Récents" dans la palette de commandes (⌘K) — pur confort
  // local, voir src/lib/recent-items.ts.
  useEffect(() => {
    recordRecentItem({ type: "task", id: task.id, label: task.title, href: `/taches/${task.id}` });
  }, [task.id, task.title]);

  function patch(p: Partial<TaskFormValues>) {
    setValues((v) => ({ ...v, ...p }));
  }

  async function refreshTask() {
    const fresh = await getTaskDetail(task.id);
    if (fresh) setTask(fresh);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateTask({
        taskId: task.id,
        title: values.title,
        description: values.description || null,
        studioId: values.studioId,
        projectId: values.projectId || null,
        assigneeId: values.assigneeId || null,
        startDate: values.startDate,
        endDate: values.endDate < values.startDate ? values.startDate : values.endDate,
        maxDurationDays: values.maxDurationDays ? Number(values.maxDurationDays) : null,
        statusId: values.statusId,
        dependsOnId: values.dependsOnId || null,
        estimatedHalfDays: values.estimatedHalfDays ? Number(values.estimatedHalfDays) : null,
        recurrenceFrequency: values.recurrenceFrequency ? (values.recurrenceFrequency as "WEEKLY" | "MONTHLY") : null,
        recurrenceInterval: values.recurrenceFrequency ? Number(values.recurrenceInterval) || 1 : null,
        recurrenceUntil: values.recurrenceFrequency && values.recurrenceUntil ? values.recurrenceUntil : null,
        expectedVersion: task.version,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/taches");
      router.refresh();
    });
  }

  function trash() {
    if (!confirm(`Mettre « ${task.title} » à la corbeille ?`)) return;
    startTransition(async () => {
      const result = await trashTask(task.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/taches");
      router.refresh();
    });
  }

  function restore() {
    startTransition(async () => {
      await restoreTask(task.id);
      router.push("/taches");
      router.refresh();
    });
  }

  function duplicate() {
    if (!confirm(`Dupliquer « ${task.title} » ? Décalée pour démarrer aujourd’hui.`)) return;
    startTransition(async () => {
      const result = await duplicateTask(task.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/taches/${result.id}`);
      router.refresh();
    });
  }

  function addLink() {
    if (!linkUrl.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addLinkAttachment({
        taskId: task.id,
        name: linkName.trim() || linkUrl.trim(),
        url: linkUrl.trim(),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setLinkName("");
      setLinkUrl("");
      await refreshTask();
      router.refresh();
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("taskId", task.id);
    fd.set("file", file);
    setError(null);
    startTransition(async () => {
      const result = await uploadFileAttachment(fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      await refreshTask();
      router.refresh();
    });
    e.target.value = "";
  }

  function removeAttachment(id: string) {
    startTransition(async () => {
      await deleteAttachment(id);
      await refreshTask();
      router.refresh();
    });
  }

  function submitSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setSubtaskError(null);
    startTransition(async () => {
      const result = await addSubtask({
        taskId: task.id,
        title: newSubtaskTitle.trim(),
        dueDate: newSubtaskDue || null,
      });
      if (result.error) {
        setSubtaskError(result.error);
        return;
      }
      setNewSubtaskTitle("");
      setNewSubtaskDue("");
      await refreshTask();
      router.refresh();
    });
  }

  function toggleSub(id: string, done: boolean) {
    startTransition(async () => {
      await toggleSubtask(id, done);
      await refreshTask();
      router.refresh();
    });
  }

  function removeSubtask(id: string) {
    startTransition(async () => {
      await deleteSubtask(id);
      await refreshTask();
      router.refresh();
    });
  }

  function handleStartTimer() {
    setTimeError(null);
    startTransition(async () => {
      const result = await startTimer({ taskId: task.id, studioId: task.studioId });
      if (result.error) {
        setTimeError(result.error);
        return;
      }
      await refreshTask();
      router.refresh();
    });
  }

  function handleStopTimer(entryId: string) {
    setTimeError(null);
    startTransition(async () => {
      const result = await stopTimer(entryId);
      if (result.error) {
        setTimeError(result.error);
        return;
      }
      await refreshTask();
      router.refresh();
    });
  }

  function handleManualTime() {
    setTimeError(null);
    startTransition(async () => {
      const result = await addManualEntry({
        taskId: task.id,
        studioId: task.studioId,
        date: manualDate,
        hours: Number(manualHours) || 0,
        minutes: Number(manualMinutes) || 0,
        note: null,
      });
      if (result.error) {
        setTimeError(result.error);
        return;
      }
      setShowManualTime(false);
      await refreshTask();
      router.refresh();
    });
  }

  function handleDeleteTime(entryId: string) {
    startTransition(async () => {
      const result = await deleteTimeEntry(entryId);
      if (result.error) {
        setTimeError(result.error);
        return;
      }
      await refreshTask();
      router.refresh();
    });
  }

  function mention(name: string) {
    const tag = `@${name} `;
    setCommentBody((b) => (b.includes(tag) ? b : `${b}${b && !b.endsWith(" ") ? " " : ""}${tag}`));
  }

  function submitComment() {
    if (!commentBody.trim()) return;
    setCommentError(null);
    startTransition(async () => {
      const result = await addComment({ taskId: task.id, body: commentBody.trim() });
      if (result.error) {
        setCommentError(result.error);
        return;
      }
      setCommentBody("");
      await refreshTask();
    });
  }

  // La dépendance actuelle doit toujours apparaître comme option valide,
  // même si la tâche dont on dépend est passée à la corbeille depuis —
  // sinon le select retombe silencieusement sur "Aucune dépendance" alors
  // que le lien existe toujours (voir getTaskDetail).
  const dependencyOptions =
    task.dependsOn && !tasks.some((t) => t.id === task.dependsOn!.id)
      ? [
          ...tasks.filter((t) => t.id !== task.id),
          { ...task.dependsOn, title: `${task.dependsOn.title} (à la corbeille)` },
        ]
      : tasks.filter((t) => t.id !== task.id);

  const filteredAttachments = task.attachments.filter((a) =>
    a.name.toLowerCase().includes(attachmentSearch.trim().toLowerCase()),
  );

  // Fil d'activité unique — commentaires, pièces jointes et journal fusionnés
  // par ordre chronologique, plutôt que trois cartes séparées : "que s'est-il
  // passé sur cette tâche" se lit d'un coup, comme un fil de discussion,
  // plutôt qu'en recoupant mentalement plusieurs sections. La table Pièces
  // jointes plus haut reste l'endroit où déposer/retirer un fichier — ce fil
  // ne fait qu'en rendre compte au bon moment dans la chronologie.
  const activity = [
    ...task.comments.map((c) => ({
      type: "comment" as const,
      id: c.id,
      createdAt: c.createdAt,
      actorName: c.authorName,
      body: c.body,
    })),
    ...task.attachments.map((a) => ({
      type: "attachment" as const,
      id: a.id,
      createdAt: a.createdAt,
      actorName: a.uploadedBy?.name ?? "Quelqu’un",
      name: a.name,
    })),
    ...task.journalEntries.map((j) => ({
      type: "journal" as const,
      id: j.id,
      createdAt: j.createdAt,
      actorName: j.actorName,
      action: j.action,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div className="px-8 py-8">
      <Breadcrumb items={[{ label: "Tâches", href: "/taches" }, { label: task.title }]} />
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        {task.title}
      </h1>

      <div className="sticky top-0 z-10 -mx-8 mb-6 flex items-center justify-between gap-2.5 border-b border-line bg-paper px-8 py-3">
        {task.trashedAt ? (
          <button
            type="button"
            onClick={restore}
            className={`flex items-center gap-1.5 text-sm font-semibold text-heading ${textButtonClass}`}
          >
            <RotateCcw size={14} /> Restaurer
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={trash}
              className={`flex items-center gap-1.5 px-2 py-1 text-sm font-semibold ${dangerButtonClass}`}
            >
              <Trash2 size={14} /> Corbeille
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={duplicate}
              className={`flex items-center gap-1.5 text-sm font-semibold text-heading disabled:opacity-60 ${textButtonClass}`}
            >
              <Copy size={14} /> Dupliquer
            </button>
          </div>
        )}
        <div className="flex gap-2.5">
          <Link href="/taches" className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
            Retour à la liste
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-xs font-semibold text-alert">
          {error}
        </p>
      )}

      {!task.status.isDone && toIsoDate(task.endDate) < today() && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold"
          style={{ background: "var(--color-alert-wash)", color: "var(--color-alert)" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0" />
          En retard — échéance dépassée.
        </div>
      )}

      {task.trashedAt && (
        <p className="mb-4 rounded-lg border border-line bg-wash px-3 py-2 text-xs text-ink-muted">
          À la corbeille depuis le {quandFr(task.trashedAt)}.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <TaskFormFields
            values={values}
            onChange={patch}
            studios={studios}
            projects={projects}
            people={people}
            statuses={statuses}
            tasks={dependencyOptions}
            showStatus
            excludeTaskId={task.id}
          />

          <FieldSection
            title={`Sous-tâches (${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length})`}
            icon={ListChecks}
          >
            <div className="mb-3 flex flex-col gap-1.5">
              {task.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => toggleSub(s.id, e.target.checked)}
                    aria-label={`${s.title} — ${s.done ? "faite" : "à faire"}`}
                  />
                  <span className={`flex-1 ${s.done ? "text-ink-muted line-through" : "text-ink"}`}>{s.title}</span>
                  {s.dueDate && <span className="text-2xs text-ink-muted tabular-nums">{quandFr(s.dueDate)}</span>}
                  <button
                    type="button"
                    onClick={() => removeSubtask(s.id)}
                    aria-label={`Retirer ${s.title}`}
                    className={`flex-shrink-0 p-0.5 text-ink-muted hover:text-alert ${textButtonClass}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Nouvelle sous-tâche"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className={`${fieldInputClass} min-w-[160px] flex-1`}
              />
              <input
                type="date"
                value={newSubtaskDue}
                onChange={(e) => setNewSubtaskDue(e.target.value)}
                aria-label="Échéance (facultatif)"
                className={fieldInputClass}
              />
              <button
                type="button"
                disabled={!newSubtaskTitle.trim()}
                onClick={submitSubtask}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>
            {subtaskError && (
              <p role="alert" className="mb-3 text-xs font-semibold text-alert">
                {subtaskError}
              </p>
            )}
          </FieldSection>

          <FieldSection title={`Pièces jointes (${task.attachments.length})`} icon={Paperclip}>
            {task.attachments.length > 3 && (
              <div className="mb-3">
                <SearchField value={attachmentSearch} onChange={setAttachmentSearch} placeholder="Rechercher un fichier…" className="max-w-xs" />
              </div>
            )}
            {task.attachments.length > 0 && (
              <div className="mb-3 overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-wash text-left text-2xs font-semibold text-ink-muted uppercase">
                      <th className="px-2.5 py-1.5">Fichier</th>
                      <th className="px-2.5 py-1.5">Taille</th>
                      <th className="px-2.5 py-1.5">Déposé par</th>
                      <th className="px-2.5 py-1.5">Déposé le</th>
                      <th className="w-8 px-2.5 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttachments.map((a) => (
                      <tr key={a.id} className="border-b border-line last:border-b-0">
                        <td className="px-2.5 py-1.5">
                          <a
                            href={a.kind === "LINK" ? (a.url ?? "#") : `/api/attachments/${a.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 text-heading underline-offset-2 hover:underline"
                          >
                            {a.kind === "LINK" ? (
                              <ExternalLink size={13} className="flex-shrink-0" aria-hidden="true" />
                            ) : (
                              <Paperclip size={13} className="flex-shrink-0" aria-hidden="true" />
                            )}
                            <span className="truncate">{a.name}</span>
                          </a>
                        </td>
                        <td className="px-2.5 py-1.5 text-ink-muted tabular-nums">
                          {a.sizeBytes != null ? formatFileSize(a.sizeBytes) : "—"}
                        </td>
                        <td className="px-2.5 py-1.5 text-ink-muted">{a.uploadedBy?.name ?? "—"}</td>
                        <td className="px-2.5 py-1.5 text-ink-muted tabular-nums">{quandFr(a.createdAt)}</td>
                        <td className="px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            aria-label={`Retirer ${a.name}`}
                            className={`p-0.5 text-ink-muted hover:text-alert ${textButtonClass}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Nom (facultatif)"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className={`${fieldInputClass} min-w-[120px] flex-1`}
              />
              <input
                type="url"
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className={`${fieldInputClass} min-w-[160px] flex-[2]`}
              />
              <button type="button" onClick={addLink} className={`px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
                Joindre le lien
              </button>
              <label className={`flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
                <Paperclip size={14} /> Déposer un fichier
                <input type="file" className="hidden" onChange={onFileChange} />
              </label>
            </div>
          </FieldSection>

          <FieldSection title={`Activité (${activity.length})`} icon={MessageSquare}>
            <div className="mb-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
              {activity.map((item) => {
                if (item.type === "comment") {
                  return (
                    <div key={`comment-${item.id}`} className="rounded-lg border border-line p-2.5 text-sm">
                      <div className="mb-0.5 flex items-baseline gap-2">
                        <span className="font-semibold text-heading">{item.actorName}</span>
                        <span className="text-2xs text-ink-muted">{quandFr(item.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-ink">{item.body}</p>
                    </div>
                  );
                }
                if (item.type === "attachment") {
                  return (
                    <p key={`attachment-${item.id}`} className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <Paperclip size={12} className="flex-shrink-0" />
                      <span className="font-semibold text-heading">{item.actorName}</span> a joint « {item.name} »
                      <span> — {quandFr(item.createdAt)}</span>
                    </p>
                  );
                }
                return (
                  <p key={`journal-${item.id}`} className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <History size={12} className="flex-shrink-0" />
                    {item.action}
                    <span> — {item.actorName}, {quandFr(item.createdAt)}</span>
                  </p>
                );
              })}
            </div>
            <div>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Ajouter un commentaire… utilisez les puces ci-dessous pour mentionner quelqu’un."
                rows={2}
                className={`${fieldInputClass} mb-1.5`}
              />
              <div className="mb-2 flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => mention(p.name)}
                    className={`flex items-center gap-1 rounded-md border border-line px-2 py-1 text-2xs font-semibold text-ink-muted ${textButtonClass}`}
                  >
                    <AtSign size={11} /> {p.name}
                  </button>
                ))}
              </div>
              {commentError && (
                <p role="alert" className="mb-1.5 text-xs font-semibold text-alert">
                  {commentError}
                </p>
              )}
              <button
                type="button"
                disabled={pending || !commentBody.trim()}
                onClick={submitComment}
                className={`px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
              >
                Commenter
              </button>
            </div>
          </FieldSection>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-line p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-2xs font-bold tracking-wide text-ink-muted uppercase">
              <Timer size={13} /> Temps ({formatDurationFr(sumDurationMinutes(task.timeEntries))})
            </h3>
            <div className="mb-3 flex flex-col gap-1.5">
              {task.timeEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <span className="flex-1 truncate text-ink">{e.person?.name ?? "Quelqu’un d’autre"}</span>
                  <span className="flex-shrink-0 text-xs font-semibold text-ink tabular-nums">
                    {formatDurationFr(entryDurationMinutes(e))}
                  </span>
                  {/* Sans `person` (écriture d'un tiers, vue non-admin — voir getTaskDetail), ni retrait ni arrêt :
                      le serveur les refuserait de toute façon (seul l'auteur ou un admin peut agir dessus). */}
                  {e.person &&
                    (e.endedAt ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteTime(e.id)}
                        aria-label={`Retirer cette écriture de ${e.person.name}`}
                        className={`flex-shrink-0 p-0.5 text-ink-muted hover:text-alert ${textButtonClass}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStopTimer(e.id)}
                        aria-label="Arrêter ce minuteur"
                        className={`flex-shrink-0 p-0.5 text-alert ${textButtonClass}`}
                      >
                        <Square size={13} />
                      </button>
                    ))}
                </div>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleStartTimer}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                <Timer size={14} /> Démarrer un minuteur
              </button>
              <button
                type="button"
                onClick={() => setShowManualTime((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                <Plus size={14} /> Saisie manuelle
              </button>
            </div>
            {showManualTime && (
              <div className="mb-2 flex flex-wrap items-end gap-2">
                <input
                  type="date"
                  aria-label="Date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className={fieldInputClass}
                />
                <input
                  type="number"
                  aria-label="Heures"
                  min={0}
                  max={24}
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className={`${fieldInputClass} w-16`}
                />
                <input
                  type="number"
                  aria-label="Minutes"
                  min={0}
                  max={59}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className={`${fieldInputClass} w-16`}
                />
                <button type="button" onClick={handleManualTime} className={`px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
                  Ajouter
                </button>
              </div>
            )}
            {timeError && (
              <p role="alert" className="text-xs font-semibold text-alert">
                {timeError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
