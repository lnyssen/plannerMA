"use client";

import type { ProjectPole } from "@prisma/client";
import { AlertTriangle, BookmarkCheck, Archive, Copy, Flag, ListChecks, Plus, RotateCcw, Timer, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createMilestone, deleteMilestone, setMilestoneDone } from "@/lib/actions/milestones";
import {
  duplicateProject,
  getProjectDetail,
  setProjectArchived,
  setProjectTemplate,
  updateProject,
  type ProjectDetail,
} from "@/lib/actions/projects";
import type { ClientSummary } from "@/lib/data/clients";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import { formatShortFr, quandFr, toIsoDate, today } from "@/lib/planning/dates";
import { PROJECT_POLE_LABELS } from "@/lib/planning/labels";
import { entryDurationMinutes, formatDurationFr, sumDurationMinutes } from "@/lib/planning/time";
import { recordRecentItem } from "@/lib/recent-items";
import { ClientPicker } from "@/components/modals/client-picker";
import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { FieldLabel, FieldSection, fieldInputClass } from "@/components/modals/modal-shell";

export function EditProjectView({
  initialProject,
  studios,
  clients,
  people,
  activeProjects,
  isAdmin,
}: {
  initialProject: ProjectDetail;
  studios: StudioSummary[];
  clients: ClientSummary[];
  people: PersonSummary[];
  activeProjects: ProjectOption[];
  /** La répartition du temps par personne n'est montrée qu'aux administrateurs (voir getProjectDetail) — le total reste visible à tous. */
  isAdmin: boolean;
}) {
  const router = useRouter();
  const ask = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [project, setProject] = useState<ProjectDetail>(initialProject);
  const [name, setName] = useState(initialProject.name);
  const [code, setCode] = useState(initialProject.code ?? "");
  const [clientId, setClientId] = useState<string | null>(initialProject.clientId);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [pole, setPole] = useState<ProjectPole | "">(initialProject.pole ?? "");
  const [studioIds, setStudioIds] = useState<string[]>(initialProject.studios.map((s) => s.studioId));
  const [budgetHours, setBudgetHours] = useState(initialProject.budgetHours != null ? String(initialProject.budgetHours) : "");
  const [error, setError] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState(today());
  const [milestoneError, setMilestoneError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  // Alimente "Récents" dans la palette de commandes (⌘K) — pur confort
  // local, voir src/lib/recent-items.ts.
  useEffect(() => {
    recordRecentItem({
      type: "project",
      id: project.id,
      label: `${project.client.name} — ${project.name}`,
      href: `/projets/${project.id}`,
    });
  }, [project.id, project.name, project.client.name]);

  async function loadProject() {
    const p = await getProjectDetail(project.id);
    if (p) {
      setProject(p);
      setName(p.name);
      setCode(p.code ?? "");
      setClientId(p.clientId);
      setPole(p.pole ?? "");
      setStudioIds(p.studios.map((s) => s.studioId));
      setBudgetHours(p.budgetHours != null ? String(p.budgetHours) : "");
    }
    return p;
  }

  const allTimeEntries = useMemo(
    () => [...project.timeEntries, ...project.tasks.flatMap((t) => t.timeEntries)],
    [project],
  );
  const loggedMinutes = useMemo(() => sumDurationMinutes(allTimeEntries), [allTimeEntries]);
  // La répartition par personne n'existe dans les données que pour un
  // administrateur — getProjectDetail met personId/person à nul sinon
  // (toujours présents, jamais absents, pour que ce test suffise à
  // discriminer proprement les deux formes possibles du type).
  const byPerson = useMemo(() => {
    const totals = new Map<string, { name: string; minutes: number }>();
    for (const e of allTimeEntries) {
      if (!e.person || !e.personId) continue;
      const current = totals.get(e.personId) ?? { name: e.person.name, minutes: 0 };
      current.minutes += entryDurationMinutes(e);
      totals.set(e.personId, current);
    }
    return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
  }, [allTimeEntries]);
  const budgetMinutes = project.budgetHours != null ? project.budgetHours * 60 : null;
  const overBudget = budgetMinutes != null && loggedMinutes > budgetMinutes;

  /**
   * Répartition des heures du projet, de la tâche la plus consommatrice à la
   * moins. Au-delà de cinq lignes, le reste est regroupé : la question est
   * « qu'est-ce qui a coûté », pas « la liste exhaustive », qui est déjà
   * plus bas dans la page.
   */
  const consommation = useMemo(() => {
    const lignes = project.tasks
      .map((t) => ({ label: t.title, minutes: sumDurationMinutes(t.timeEntries) }))
      .filter((l) => l.minutes > 0);
    const horsTache = sumDurationMinutes(project.timeEntries);
    if (horsTache > 0) lignes.push({ label: "Hors tâche (rattaché au projet)", minutes: horsTache });
    lignes.sort((a, b) => b.minutes - a.minutes);
    if (lignes.length <= 6) return lignes;
    const tete = lignes.slice(0, 5);
    const reste = lignes.slice(5).reduce((sum, l) => sum + l.minutes, 0);
    return [...tete, { label: `${lignes.length - 5} autres tâches`, minutes: reste }];
  }, [project.tasks, project.timeEntries]);

  function toggleStudio(id: string) {
    setStudioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addMilestone() {
    if (!newMilestoneTitle.trim()) return;
    setMilestoneError(null);
    startTransition(async () => {
      const result = await createMilestone({ projectId: project.id, title: newMilestoneTitle.trim(), dueDate: newMilestoneDue });
      if (result.error) {
        setMilestoneError(result.error);
        return;
      }
      setNewMilestoneTitle("");
      await loadProject();
      router.refresh();
    });
  }

  function toggleMilestone(id: string, isDone: boolean) {
    startTransition(async () => {
      await setMilestoneDone(id, isDone);
      await loadProject();
      router.refresh();
    });
  }

  function removeMilestone(id: string) {
    startTransition(async () => {
      await deleteMilestone(id);
      await loadProject();
      router.refresh();
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateProject({
        projectId: project.id,
        name,
        code: code.trim() || null,
        clientId,
        newClientName,
        pole: pole || null,
        studioIds,
        budgetHours: budgetHours ? Number(budgetHours) : null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast("Projet enregistré.");
      router.push("/projets");
      router.refresh();
    });
  }

  function toggleArchived() {
    startTransition(async () => {
      await setProjectArchived({ projectId: project.id, archived: !project.archived });
      toast(project.archived ? "Projet réactivé." : "Projet archivé.");
      router.push("/projets");
      router.refresh();
    });
  }

  function toggleTemplate() {
    startTransition(async () => {
      const result = await setProjectTemplate({ projectId: project.id, isTemplate: !project.isTemplate });
      if (result?.error) {
        toast(result.error, "error");
        return;
      }
      toast(project.isTemplate ? "Ce projet n’est plus un modèle." : "Projet marqué comme modèle.");
      router.refresh();
    });
  }

  async function duplicate() {
    const ok = await ask({
      title: `Dupliquer « ${project.name} » ?`,
      body: "Les tâches actives sont copiées avec leurs sous-tâches, dépendances et jalons, décalées pour démarrer aujourd’hui.",
      confirmLabel: "Dupliquer",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await duplicateProject(project.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast("Copie du projet créée.");
      router.push(`/projets/${result.id}`);
      router.refresh();
    });
  }

  return (
    <div className="px-8 py-8">
      <Breadcrumb items={[{ label: "Projets", href: "/projets" }, { label: project.name }]} />
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
        {project.name}
      </h1>

      <div className="sticky top-0 z-10 -mx-8 mb-6 flex items-center justify-between gap-2.5 border-b border-line bg-paper px-8 py-3">
        {isAdmin ? (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleArchived}
              className={`flex items-center gap-1.5 text-sm font-semibold text-heading ${textButtonClass}`}
            >
              {project.archived ? (
                <>
                  <RotateCcw size={14} /> Réactiver
                </>
              ) : (
                <>
                  <Archive size={14} /> Archiver
                </>
              )}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={duplicate}
              className={`flex items-center gap-1.5 text-sm font-semibold text-heading disabled:opacity-60 ${textButtonClass}`}
            >
              <Copy size={14} /> Dupliquer
            </button>
            {/* Un modèle reste un projet ordinaire : la marque sert seulement
                à le faire remonter au moment d'en créer un nouveau. */}
            <button
              type="button"
              disabled={pending}
              onClick={toggleTemplate}
              title={
                project.isTemplate
                  ? "Ce projet est proposé comme point de départ à la création"
                  : "Le proposer comme point de départ à la création d’un projet"
              }
              className={`flex items-center gap-1.5 text-sm font-semibold disabled:opacity-60 ${textButtonClass} ${
                project.isTemplate ? "text-heading" : "text-ink-muted"
              }`}
            >
              <BookmarkCheck size={14} /> {project.isTemplate ? "Modèle" : "Marquer comme modèle"}
            </button>
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2.5">
          <Link href="/projets" className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
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

      {overBudget && (
        <div className="mb-4 rounded-lg px-3 py-2.5" style={{ background: "var(--color-alert-wash)" }}>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--color-alert)" }}>
            <AlertTriangle size={16} className="flex-shrink-0" />
            Budget dépassé de {formatDurationFr(loggedMinutes - budgetMinutes!)} :{" "}
            {formatDurationFr(loggedMinutes)} enregistrées sur {formatDurationFr(budgetMinutes!)} prévues.
          </div>

          {/* Annoncer un dépassement sans dire d'où il vient oblige à aller
              chercher l'information ailleurs, alors qu'elle est déjà à
              l'écran. La ventilation par tâche répond à la seule question
              qu'on se pose en lisant ce bandeau : où sont passées les heures. */}
          {consommation.length > 0 && (
            <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "color-mix(in srgb, var(--color-alert) 25%, transparent)" }}>
              <p className="mb-1.5 text-2xs font-semibold tracking-wide uppercase" style={{ color: "var(--color-alert)" }}>
                Où sont passées les heures
              </p>
              <div className="flex flex-col gap-1">
                {consommation.map((c) => (
                  <div key={c.label} className="flex items-center gap-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate text-ink">{c.label}</span>
                    <span className="h-1.5 w-24 flex-shrink-0 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--color-alert) 18%, transparent)" }}>
                      <span className="block h-full rounded-full" style={{ width: `${(c.minutes / loggedMinutes) * 100}%`, background: "var(--color-alert)" }} />
                    </span>
                    <span className="w-16 flex-shrink-0 text-right font-semibold text-ink tabular-nums">{formatDurationFr(c.minutes)}</span>
                    <span className="w-9 flex-shrink-0 text-right text-ink-muted tabular-nums">
                      {Math.round((c.minutes / loggedMinutes) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {project.archived && (
        <p className="mb-4 rounded-lg border border-line bg-wash px-3 py-2 text-xs text-ink-muted">Ce projet est archivé.</p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <FieldSection title="Informations" first>
            <FieldLabel htmlFor="edit-project-name">Nom du projet</FieldLabel>
            <input
              id="edit-project-name"
              className={`${fieldInputClass} mb-3`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <FieldLabel htmlFor="edit-project-code">Code (facultatif)</FieldLabel>
            <input
              id="edit-project-code"
              className={`${fieldInputClass} mb-3`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="BETTER-3, ONE-6…"
            />

            <ClientPicker
              clients={clients}
              clientId={clientId}
              newClientName={newClientName}
              onChange={(p) => {
                setClientId(p.clientId);
                setNewClientName(p.newClientName);
              }}
            />

            {/* Interne/externe se saisit sur la fiche du client : c'est une
                propriété du client, pas de chacun de ses projets. */}
            <FieldLabel htmlFor="edit-project-pole">Pôle</FieldLabel>
            <select
              id="edit-project-pole"
              className={`${fieldInputClass} mb-3`}
              value={pole}
              onChange={(e) => setPole(e.target.value as ProjectPole | "")}
            >
              <option value="">Aucun pôle particulier</option>
              {Object.entries(PROJECT_POLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <FieldLabel>Studios concernés</FieldLabel>
            <div className="mb-4 flex flex-wrap gap-2">
              {studios.map((s) => {
                const checked = studioIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink transition-colors duration-100 hover:bg-wash active:bg-heading/10"
                    style={{ border: `1.5px solid ${checked ? "var(--color-heading)" : "var(--color-line)"}` }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleStudio(s.id)} />
                    {s.name}
                  </label>
                );
              })}
            </div>

            <FieldLabel htmlFor="edit-project-budget">Budget de temps (heures, facultatif)</FieldLabel>
            <input
              id="edit-project-budget"
              type="number"
              min={1}
              step={1}
              className={`${fieldInputClass} mb-1.5 max-w-[140px]`}
              value={budgetHours}
              onChange={(e) => setBudgetHours(e.target.value)}
              placeholder="—"
            />
            <p className="flex items-center gap-1.5 text-xs" style={{ color: overBudget ? "var(--color-alert)" : "var(--color-ink-muted)" }}>
              {overBudget && <AlertTriangle size={13} className="flex-shrink-0" />}
              <Timer size={13} className="flex-shrink-0" aria-hidden="true" />
              {formatDurationFr(loggedMinutes)} enregistrées
              {budgetMinutes != null && ` sur ${formatDurationFr(budgetMinutes)} prévues`}
            </p>
            {isAdmin && byPerson.length > 0 && (
              <div className="mt-1 flex flex-col gap-1">
                {byPerson.map((p) => (
                  <p key={p.name} className="flex items-center gap-1.5 pl-[19px] text-2xs text-ink-muted">
                    <Users size={11} className="flex-shrink-0" aria-hidden="true" />
                    {p.name} — {formatDurationFr(p.minutes)}
                  </p>
                ))}
              </div>
            )}
          </FieldSection>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-line p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-baseline gap-1.5 font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.1px] text-heading">
                <ListChecks size={14} className="self-center" aria-hidden="true" /> Tâches
                {project.tasks.length > 0 && (
                  <span className="text-sm font-semibold text-ink-muted tabular-nums">{project.tasks.length}</span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setCreatingTask(true)}
                className={`flex h-8! items-center gap-1 px-2 text-2xs font-semibold ${secondaryButtonClass}`}
              >
                <Plus size={12} /> Nouvelle tâche
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {project.tasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/taches/${t.id}`}
                  className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm transition-colors duration-100 hover:border-heading"
                >
                  <span
                    className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-semibold"
                    style={{ background: t.status.fillHex, color: t.status.colorHex }}
                  >
                    {t.status.name}
                  </span>
                  <span className="flex-1 truncate text-ink">{t.title}</span>
                  {t.assignee && <span className="flex-shrink-0 text-2xs text-ink-muted">{t.assignee.name}</span>}
                  <span className="flex-shrink-0 text-2xs text-ink-muted tabular-nums">
                    {formatShortFr(toIsoDate(t.startDate))}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line p-4">
            <h3 className="mb-3 flex items-baseline gap-1.5 font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.1px] text-heading">
              <Flag size={14} className="self-center" aria-hidden="true" /> Jalons
              {project.milestones.length > 0 && (
                <span className="text-sm font-semibold text-ink-muted tabular-nums">{project.milestones.length}</span>
              )}
            </h3>
            <div className="mb-3 flex flex-col gap-1.5">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={m.isDone}
                    onChange={(e) => toggleMilestone(m.id, e.target.checked)}
                    aria-label={`${m.title} — ${m.isDone ? "atteint" : "à venir"}`}
                  />
                  <span className={`flex-1 ${m.isDone ? "text-ink-muted line-through" : "text-ink"}`}>{m.title}</span>
                  <span className="text-2xs text-ink-muted tabular-nums">{formatShortFr(toIsoDate(m.dueDate))}</span>
                  <button
                    type="button"
                    onClick={() => removeMilestone(m.id)}
                    aria-label={`Retirer ${m.title}`}
                    className={`flex-shrink-0 p-0.5 text-ink-muted hover:text-alert ${textButtonClass}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Nouveau jalon"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                className={`${fieldInputClass} min-w-[120px] flex-1`}
              />
              <input
                type="date"
                value={newMilestoneDue}
                onChange={(e) => setNewMilestoneDue(e.target.value)}
                aria-label="Échéance du jalon"
                className={fieldInputClass}
              />
              <button
                type="button"
                disabled={!newMilestoneTitle.trim()}
                onClick={addMilestone}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>
            {milestoneError && (
              <p role="alert" className="text-xs font-semibold text-alert">
                {milestoneError}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-line p-4">
            <h3 className="mb-3 text-2xs font-bold tracking-wide text-ink-muted uppercase">
              Historique ({project.journalEntries.length})
            </h3>
            <div className="flex flex-col gap-1.5">
              {project.journalEntries.map((entry) => (
                <p key={entry.id} className="text-xs text-ink">
                  {entry.action}
                  <span className="text-ink-muted"> — {entry.actorName}, {quandFr(entry.createdAt)}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {creatingTask && (
        <CreateTaskModal
          studios={studios}
          projects={activeProjects}
          people={people}
          initialValues={{ projectId: project.id, studioIds: project.studios[0] ? [project.studios[0].studioId] : studios[0] ? [studios[0].id] : [] }}
          onClose={() => setCreatingTask(false)}
          onCreated={() => {
            setCreatingTask(false);
            loadProject();
          }}
        />
      )}
    </div>
  );
}
