"use client";

import { useMemo, useState } from "react";
import { FieldLabel, fieldInputClass } from "@/components/modals/modal-shell";

interface CascadeTask {
  id: string;
  title: string;
  project: { id: string; name: string; client: { id: string; name: string } } | null;
}

/** Regroupe les tâches sans projet sous une entrée à part plutôt que de les exclure — elles restent choisissables. */
const NO_PROJECT = "__sans_projet__";

function uniqueClients<T extends CascadeTask>(tasks: T[]) {
  const map = new Map<string, string>();
  let hasNoProject = false;
  for (const t of tasks) {
    if (t.project) map.set(t.project.client.id, t.project.client.name);
    else hasNoProject = true;
  }
  const list = [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  if (hasNoProject) list.push({ id: NO_PROJECT, name: "Sans projet" });
  return list;
}

function projectsForClient<T extends CascadeTask>(tasks: T[], clientId: string) {
  if (clientId === NO_PROJECT) return [{ id: NO_PROJECT, name: "Sans projet" }];
  const map = new Map<string, string>();
  for (const t of tasks) {
    if (t.project?.client.id === clientId) map.set(t.project.id, t.project.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function tasksForProject<T extends CascadeTask>(tasks: T[], projectId: string) {
  const list = tasks.filter((t) => (projectId === NO_PROJECT ? !t.project : t.project?.id === projectId));
  return [...list].sort((a, b) => a.title.localeCompare(b.title));
}

function clientIdOf(task: CascadeTask | null): string {
  if (!task) return "";
  return task.project ? task.project.client.id : NO_PROJECT;
}

function projectIdOf(task: CascadeTask | null): string {
  if (!task) return "";
  return task.project ? task.project.id : NO_PROJECT;
}

/**
 * Client → Projet → Tâche en trois menus en cascade, plutôt qu'un seul menu
 * listant toutes les tâches de tous les clients bout à bout : ce dernier
 * n'offrait ni recherche ni filtre, juste un long défilement (et un texte
 * tronqué dès que le libellé combiné dépassait la largeur du champ). Chaque
 * niveau réduit le suivant, remplace TaskCombobox (menu unique) et le
 * <select> "Dépend de" à libellé concaténé — mêmes deux endroits qui en
 * avaient besoin dans l'appli.
 */
export function TaskCascadeFields<T extends CascadeTask>({
  tasks,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "Aucune",
  idPrefix = "cascade",
}: {
  tasks: T[];
  /** Id de la tâche choisie, "" si aucune (seulement valide avec allowEmpty). */
  value: string;
  onChange: (taskId: string) => void;
  /** "Dépend de" autorise "Aucune dépendance" ; le mode "Tâche planifiée" du suivi de temps non — une tâche y est toujours requise. */
  allowEmpty?: boolean;
  emptyLabel?: string;
  idPrefix?: string;
}) {
  const selectedTask = tasks.find((t) => t.id === value) ?? null;
  const clients = useMemo(() => uniqueClients(tasks), [tasks]);
  // Sans tâche choisie (allowEmpty, "Aucune dépendance"), Client/Projet
  // retombent sur le premier de la liste plutôt que de rester vides : un
  // <select> sans option "" correspondante affiche son premier <option> de
  // toute façon (comportement natif du navigateur), donc autant que l'état
  // interne soit cohérent avec ce qui s'affiche réellement.
  const [clientId, setClientId] = useState(() => clientIdOf(selectedTask) || clients[0]?.id || "");
  const [projectId, setProjectId] = useState(
    () => projectIdOf(selectedTask) || projectsForClient(tasks, clientIdOf(selectedTask) || clients[0]?.id || "")[0]?.id || "",
  );

  // Resynchronise si `value` change depuis l'extérieur (ex. bascule de mode
  // qui pré-sélectionne une autre tâche) et ne correspond plus au client/
  // projet affichés — sans ça les deux premiers menus resteraient sur
  // l'ancien choix alors que la tâche affichée en bas a changé. Ajusté
  // pendant le rendu plutôt que dans un effet (React le permet explicitement
  // pour ce cas précis) : pas de re-rendu superflu après coup.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    const wantClient = clientIdOf(selectedTask);
    const wantProject = projectIdOf(selectedTask);
    if (wantClient) {
      setClientId(wantClient);
      setProjectId(wantProject);
    }
  }

  const projects = useMemo(() => (clientId ? projectsForClient(tasks, clientId) : []), [tasks, clientId]);
  const filteredTasks = useMemo(() => (projectId ? tasksForProject(tasks, projectId) : []), [tasks, projectId]);

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    const nextProjectId = projectsForClient(tasks, nextClientId)[0]?.id ?? "";
    setProjectId(nextProjectId);
    const nextTasks = tasksForProject(tasks, nextProjectId);
    onChange(allowEmpty ? "" : (nextTasks[0]?.id ?? ""));
  }

  function handleProjectChange(nextProjectId: string) {
    setProjectId(nextProjectId);
    const nextTasks = tasksForProject(tasks, nextProjectId);
    onChange(allowEmpty ? "" : (nextTasks[0]?.id ?? ""));
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div className="min-w-[160px] flex-1">
        <FieldLabel htmlFor={`${idPrefix}-client`}>Client</FieldLabel>
        <select
          id={`${idPrefix}-client`}
          className={fieldInputClass}
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
          disabled={clients.length === 0}
        >
          {clients.length === 0 && <option value="">—</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <FieldLabel htmlFor={`${idPrefix}-project`}>Projet</FieldLabel>
        <select
          id={`${idPrefix}-project`}
          className={fieldInputClass}
          value={projectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          disabled={clientId === NO_PROJECT || projects.length === 0}
        >
          {projects.length === 0 && <option value="">—</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[200px] flex-1">
        <FieldLabel htmlFor={`${idPrefix}-task`}>Tâche</FieldLabel>
        <select id={`${idPrefix}-task`} className={fieldInputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          {allowEmpty && <option value="">{emptyLabel}</option>}
          {filteredTasks.length === 0 && !allowEmpty && <option value="">—</option>}
          {filteredTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
