"use client";

import { createContext, useContext } from "react";

export type CreateModalKind = "task" | "project" | "request";

/**
 * Ouvre une des modales de création globales (montées une seule fois par
 * AppShell, avec les données déjà chargées pour la barre latérale) — pour
 * que les boutons "Nouvelle tâche"/"Nouveau projet"/"Nouvelle demande"
 * puissent aussi vivre sur les pages Projets/Tâches/Demandes elles-mêmes,
 * pas seulement dans la barre latérale, sans dupliquer ni re-charger les
 * données de ces modales à chaque page.
 */
const CreateModalsContext = createContext<((kind: CreateModalKind) => void) | null>(null);

export function CreateModalsProvider({
  open,
  children,
}: {
  open: (kind: CreateModalKind) => void;
  children: React.ReactNode;
}) {
  return <CreateModalsContext.Provider value={open}>{children}</CreateModalsContext.Provider>;
}

export function useCreateModals(): (kind: CreateModalKind) => void {
  const open = useContext(CreateModalsContext);
  if (!open) throw new Error("useCreateModals doit être utilisé sous CreateModalsProvider (voir AppShell).");
  return open;
}
