"use client";

import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { sortByTaskContext } from "@/lib/planning/labels";
import { TaskContextLabelParts } from "./task-context-label";

interface TaskLike {
  id: string;
  title: string;
  project: { name: string; client: { name: string } } | null;
}

interface Position {
  top: number;
  left: number;
  width: number;
}

/**
 * Remplace un <select> natif pour choisir une tâche : un <option> ne peut
 * afficher aucune mise en forme, alors que la nomenclature Client — Projet
 * — Tâche a besoin de paliers visuels distincts (voir TaskContextLabelParts)
 * pour rester lisible dans une liste dense. Toujours triée par Client puis
 * Projet puis Tâche (sortByTaskContext), jamais par ordre d'insertion.
 *
 * La liste est rendue dans un portail (document.body) en `position: fixed` —
 * pas nichée dans l'arbre du déclencheur — pour échapper au `overflow-y-auto`
 * de ModalShell (et de tout autre ancêtre qui la couperait sinon, même défaut
 * que le popover du calendrier avant sa refonte).
 */
export function TaskCombobox<T extends TaskLike>({
  id,
  tasks,
  value,
  onChange,
  className,
}: {
  id?: string;
  tasks: T[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sorted = useMemo(() => sortByTaskContext(tasks), [tasks]);
  const selected = tasks.find((t) => t.id === value) ?? null;

  function openList() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // Un scroll (page ou conteneur de modale) invalide les coordonnées
    // figées à l'ouverture — fermer plutôt qu'afficher un menu mal placé.
    function onScroll() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => (open ? setOpen(false) : openList())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${className ?? ""} flex items-center justify-between gap-2 text-left`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? <TaskContextLabelParts task={selected} /> : "—"}
        </span>
        <ChevronDown size={14} className="flex-shrink-0 text-ink-muted" />
      </button>
      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            className="fixed z-50 max-h-72 w-max min-w-[var(--trigger-width)] max-w-[min(90vw,520px)] overflow-y-auto rounded-md border-[1.5px] border-heading bg-paper py-1"
            style={{ top: position.top, left: position.left, "--trigger-width": `${position.width}px` } as React.CSSProperties}
          >
            {sorted.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={t.id === value}
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors duration-100 hover:bg-wash active:bg-heading/10"
                >
                  <Check size={14} className={`mt-0.5 flex-shrink-0 ${t.id === value ? "text-heading" : "opacity-0"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <TaskContextLabelParts task={t} />
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  );
}
