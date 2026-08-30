"use client";

import { AtSign, ExternalLink, Paperclip, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addLinkAttachment, deleteAttachment, uploadFileAttachment } from "@/lib/actions/attachments";
import { addComment } from "@/lib/actions/comments";
import { getTaskDetail, restoreTask, trashTask, updateTask, type TaskDetail } from "@/lib/actions/tasks";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { quandFr, toIsoDate } from "@/lib/planning/dates";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { fieldInputClass, ModalShell } from "./modal-shell";
import { EMPTY_TASK_FORM, TaskFormFields, type TaskFormValues } from "./task-form-fields";

export function TaskDetailModal({
  taskId,
  studios,
  projects,
  people,
  onClose,
}: {
  taskId: string;
  studios: StudioSummary[];
  projects: ProjectOption[];
  people: PersonSummary[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [values, setValues] = useState<TaskFormValues>(EMPTY_TASK_FORM);
  const [error, setError] = useState<string | null>(null);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTaskDetail(taskId).then((t) => {
      if (cancelled) return;
      if (t) {
        setTask(t);
        setValues({
          title: t.title,
          description: t.description ?? "",
          studioId: t.studioId,
          projectId: t.projectId ?? "",
          assigneeId: t.assigneeId ?? "",
          startDate: toIsoDate(t.startDate),
          endDate: toIsoDate(t.endDate),
          maxDurationDays: t.maxDurationDays != null ? String(t.maxDurationDays) : "",
          status: t.status,
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  function patch(p: Partial<TaskFormValues>) {
    setValues((v) => ({ ...v, ...p }));
  }

  async function refreshTask() {
    const fresh = await getTaskDetail(taskId);
    if (fresh) setTask(fresh);
  }

  function save() {
    if (!task) return;
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
        status: values.status,
        expectedVersion: task.version,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function trash() {
    if (!task) return;
    startTransition(async () => {
      const result = await trashTask(task.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function restore() {
    if (!task) return;
    startTransition(async () => {
      await restoreTask(task.id);
      router.refresh();
      onClose();
    });
  }

  function addLink() {
    if (!task || !linkUrl.trim()) return;
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
    if (!file || !task) return;
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

  function mention(name: string) {
    const tag = `@${name} `;
    setCommentBody((b) => (b.includes(tag) ? b : `${b}${b && !b.endsWith(" ") ? " " : ""}${tag}`));
  }

  function submitComment() {
    if (!task || !commentBody.trim()) return;
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

  return (
    <ModalShell title={loading ? "Chargement…" : (task?.title ?? "Tâche introuvable")} onClose={onClose} size="lg">
      {loading && <p className="text-sm text-ink-muted">Chargement…</p>}
      {!loading && !task && <p className="text-sm text-ink-muted">Cette tâche n’existe plus.</p>}

      {task && (
        <>
          <TaskFormFields
            values={values}
            onChange={patch}
            studios={studios}
            projects={projects}
            people={people}
            showStatus
          />

          {task.trashedAt && (
            <p className="mb-3 border border-line bg-wash px-3 py-2 text-xs text-ink-muted">
              À la corbeille depuis le {quandFr(task.trashedAt)}.
            </p>
          )}

          <h3 className="mb-2 text-xs font-semibold text-ink">Pièces jointes ({task.attachments.length})</h3>
          <div className="mb-3 flex flex-col gap-1.5">
            {task.attachments.length === 0 && <p className="text-xs text-ink-muted">Aucune pièce jointe.</p>}
            {task.attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 border border-line px-2.5 py-1.5 text-sm">
                {a.kind === "LINK" ? (
                  <ExternalLink size={14} className="flex-shrink-0 text-heading" aria-hidden="true" />
                ) : (
                  <Paperclip size={14} className="flex-shrink-0 text-heading" aria-hidden="true" />
                )}
                <a
                  href={a.kind === "LINK" ? (a.url ?? "#") : `/api/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-heading underline-offset-2 hover:underline"
                >
                  {a.name}
                </a>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Retirer ${a.name}`}
                  className={`flex-shrink-0 p-1 text-ink-muted hover:text-alert ${textButtonClass}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
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
            <button
              type="button"
              onClick={addLink}
              className={`px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
            >
              Joindre le lien
            </button>
            <label
              className={`flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
            >
              <Paperclip size={14} /> Déposer un fichier
              <input type="file" className="hidden" onChange={onFileChange} />
            </label>
          </div>

          <h3 className="mb-2 text-xs font-semibold text-ink">Commentaires ({task.comments.length})</h3>
          <div className="mb-3 flex max-h-40 flex-col gap-2 overflow-y-auto">
            {task.comments.length === 0 && <p className="text-xs text-ink-muted">Aucun commentaire.</p>}
            {task.comments.map((c) => (
              <div key={c.id} className="border border-line p-2.5 text-sm">
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className="font-semibold text-rail">{c.authorName}</span>
                  <span className="text-2xs text-ink-muted">{quandFr(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-ink">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="mb-4">
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
                  className={`flex items-center gap-1 border border-line px-2 py-1 text-2xs font-semibold text-ink-muted ${textButtonClass}`}
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

          {error && (
            <p role="alert" className="mb-3 text-xs font-semibold text-alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2.5">
            {task.trashedAt ? (
              <button
                type="button"
                onClick={restore}
                className={`flex items-center gap-1.5 text-sm font-semibold text-heading ${textButtonClass}`}
              >
                <RotateCcw size={14} /> Restaurer
              </button>
            ) : (
              <button
                type="button"
                onClick={trash}
                className={`flex items-center gap-1.5 px-2 py-1 text-sm font-semibold ${dangerButtonClass}`}
              >
                <Trash2 size={14} /> Corbeille
              </button>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                Fermer
              </button>
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
        </>
      )}
    </ModalShell>
  );
}
