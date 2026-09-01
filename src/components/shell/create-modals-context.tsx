"use client";

import { createContext, useContext } from "react";
import type { TaskFormValues } from "@/components/modals/task-form-fields";

export type CreateModalKind = "task" | "project" | "request";

/** Champs déjà connus au moment où l'on ouvre la modale (voir `open`). */
export type CreateModalPrefill = Partial<TaskFormValues>;

/**
 * Ouvre une des modales de création globales (montées une seule fois par
 * AppShell, avec les données déjà chargées pour la barre latérale) — pour
 * que les boutons "Nouvelle tâche"/"Nouveau projet"/"Nouvelle demande"
 * puissent aussi vivre sur les pages Projets/Tâches/Demandes elles-mêmes,
 * pas seulement dans la barre latérale, sans dupliquer ni re-charger les
 * données de ces modales à chaque page.
 *
 * `prefill` sert aux créations par geste direct : sélectionner une plage de
 * jours sur la ligne de quelqu'un dans Semaine, ou une plage de dates dans
 * Gantt, ouvre la modale avec la personne et les dates déjà remplies — le
 * geste porte déjà l'information, la redemander dans le formulaire serait
 * la saisir deux fois.
 */
const CreateModalsContext = createContext<((kind: CreateModalKind, prefill?: CreateModalPrefill) => void) | null>(
  null,
);

export function CreateModalsProvider({
  open,
  children,
}: {
  open: (kind: CreateModalKind, prefill?: CreateModalPrefill) => void;
  children: React.ReactNode;
}) {
  return <CreateModalsContext.Provider value={open}>{children}</CreateModalsContext.Provider>;
}

export function useCreateModals(): (kind: CreateModalKind, prefill?: CreateModalPrefill) => void {
  const open = useContext(CreateModalsContext);
  if (!open) throw new Error("useCreateModals doit être utilisé sous CreateModalsProvider (voir AppShell).");
  return open;
}
