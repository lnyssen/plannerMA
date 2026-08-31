"use client";

import type { Role } from "@prisma/client";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateNavOrder } from "@/lib/actions/account";
import { primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { applyNavOrder, NAV_ENTRIES, type NavEntry } from "@/components/shell/nav-entries";
import { ModalShell } from "./modal-shell";

function move<T>(list: T[], index: number, direction: "up" | "down"): T[] {
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= list.length) return list;
  const next = [...list];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return next;
}

export function NavOrderModal({
  role,
  initialOrder,
  onClose,
}: {
  role: Role;
  initialOrder: string[] | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const visibleEntries = NAV_ENTRIES.filter((e) => !e.adminOnly || role === "ADMIN" || (e.studioLeadOk && role === "STUDIO_LEAD"));
  const [entries, setEntries] = useState<NavEntry[]>(() => applyNavOrder(visibleEntries, initialOrder));

  function save() {
    startTransition(async () => {
      await updateNavOrder(entries.map((e) => e.href));
      router.refresh();
      onClose();
    });
  }

  function reset() {
    startTransition(async () => {
      await updateNavOrder(null);
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title="Réorganiser le menu" onClose={onClose}>
      <p className="mb-4 text-sm text-ink">Propre à votre compte — n’affecte pas les autres.</p>
      <div className="mb-5 flex flex-col gap-1.5">
        {entries.map((entry, i) => (
          <div key={entry.href} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
            <div className="flex flex-col">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => setEntries((prev) => move(prev, i, "up"))}
                aria-label={`Monter « ${entry.label} »`}
                className={`text-ink-muted disabled:opacity-30 ${textButtonClass}`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                disabled={i === entries.length - 1}
                onClick={() => setEntries((prev) => move(prev, i, "down"))}
                aria-label={`Descendre « ${entry.label} »`}
                className={`text-ink-muted disabled:opacity-30 ${textButtonClass}`}
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <entry.icon size={16} className="flex-shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="text-ink">{entry.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={reset}
          className={`flex items-center gap-1.5 text-sm font-semibold text-heading ${textButtonClass}`}
        >
          <RotateCcw size={14} /> Ordre par défaut
        </button>
        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}>
            Annuler
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
    </ModalShell>
  );
}
