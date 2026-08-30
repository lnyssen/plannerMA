"use client";

import { Plus, RefreshCw, Settings, Trash2, Users2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient, deleteClient } from "@/lib/actions/clients";
import { createStudio, renameStudio } from "@/lib/actions/studios";
import { destroyTask, restoreTask } from "@/lib/actions/tasks";
import type { ClientSummary } from "@/lib/data/clients";
import type { StudioSummary } from "@/lib/data/studios";
import { quandFr } from "@/lib/planning/dates";
import { fieldInputClass } from "@/components/modals/modal-shell";

interface TrashedTask {
  id: string;
  title: string;
  projectName: string | null;
  trashedAt: Date | null;
}

export function ReglagesView({
  studios,
  clients,
  trashedTasks,
}: {
  studios: StudioSummary[];
  clients: ClientSummary[];
  trashedTasks: TrashedTask[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"general" | "clients" | "corbeille">("general");
  const [, startTransition] = useTransition();
  const [newStudioName, setNewStudioName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const TABS = [
    { id: "general" as const, label: "Général", icon: Settings },
    { id: "clients" as const, label: "Clients", icon: Users2 },
    { id: "corbeille" as const, label: `Corbeille${trashedTasks.length ? ` (${trashedTasks.length})` : ""}`, icon: Trash2 },
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
                tab === t.id ? "bg-heading text-paper" : "border-[1.5px] border-heading text-heading"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "general" && (
        <div className="max-w-lg">
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
              className="flex items-center gap-1.5 border-[1.5px] border-heading px-3 text-sm font-semibold text-heading"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
        </div>
      )}

      {tab === "clients" && (
        <div className="max-w-lg">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">Clients</h2>
          {clients.length === 0 && <p className="mb-4 text-sm text-ink-muted">Aucun client enregistré.</p>}
          <div className="mb-4 flex flex-col gap-2">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 border border-line px-3 py-2">
                <span className="text-sm text-ink">{c.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setClientError(null);
                    startTransition(async () => {
                      const result = await deleteClient(c.id);
                      if (result.error) setClientError(result.error);
                      router.refresh();
                    });
                  }}
                  className="text-sm font-semibold text-alert"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
          {clientError && <p className="mb-3 text-xs font-semibold text-alert">{clientError}</p>}
          <div className="flex gap-2">
            <input
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Nouveau client"
              className={`${fieldInputClass} max-w-xs`}
            />
            <button
              type="button"
              onClick={() => {
                if (!newClientName.trim()) return;
                setClientError(null);
                startTransition(async () => {
                  const result = await createClient(newClientName.trim());
                  if (result.error) setClientError(result.error);
                  else setNewClientName("");
                  router.refresh();
                });
              }}
              className="flex items-center gap-1.5 border-[1.5px] border-heading px-3 text-sm font-semibold text-heading"
            >
              <Plus size={14} /> Ajouter
            </button>
          </div>
        </div>
      )}

      {tab === "corbeille" && (
        <div className="max-w-2xl">
          {trashedTasks.length === 0 && <p className="text-sm text-ink-muted">La corbeille est vide.</p>}
          <div className="flex flex-col gap-2">
            {trashedTasks.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 border border-line p-3">
                <span className="min-w-[160px] flex-1 text-sm font-semibold text-rail">{t.title}</span>
                <span className="text-xs text-ink-muted">{t.trashedAt ? quandFr(t.trashedAt) : ""}</span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await restoreTask(t.id);
                      router.refresh();
                    })
                  }
                  className="flex items-center gap-1.5 border-[1.5px] border-heading px-3 py-1.5 text-sm font-semibold text-heading"
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
                  className="flex items-center gap-1.5 border-[1.5px] border-alert px-3 py-1.5 text-sm font-semibold text-alert"
                >
                  <Trash2 size={13} /> Détruire
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
