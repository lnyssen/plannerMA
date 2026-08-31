"use client";

import { ClipboardPlus, FolderPlus, ListPlus } from "lucide-react";
import { primaryButtonClass } from "@/components/ui/buttons";
import { useCreateModals, type CreateModalKind } from "./create-modals-context";

// Icône/libellé résolus ici, pas passés en props : un composant d'icône
// (référence de fonction) n'est pas sérialisable au passage d'un Server
// Component vers un Client Component (voir taches/page.tsx, qui rend ce
// bouton depuis un composant serveur) — seul `kind`, une chaîne, traverse.
const CONFIG = {
  task: { label: "Nouvelle tâche", icon: ListPlus },
  project: { label: "Nouveau projet", icon: FolderPlus },
  request: { label: "Nouvelle demande", icon: ClipboardPlus },
} satisfies Record<CreateModalKind, { label: string; icon: typeof ListPlus }>;

/** Bouton de création, à poser à côté d'un <h1> — fonctionne aussi bien depuis une page serveur qu'un composant client. */
export function CreateButton({ kind }: { kind: CreateModalKind }) {
  const open = useCreateModals();
  const { label, icon: Icon } = CONFIG[kind];
  return (
    <button
      type="button"
      onClick={() => open(kind)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${primaryButtonClass}`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
