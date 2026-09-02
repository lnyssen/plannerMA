"use client";

import { useEffect, useState } from "react";

/** Attribut posé sur chaque colonne pour la retrouver sous le pointeur. */
export const DROP_ZONE_ATTR = "data-drop-zone";

interface DragState {
  id: string;
  label: string;
  x: number;
  y: number;
  over: string | null;
}

/**
 * Déplacement d'une carte d'une zone à l'autre, à la souris comme au doigt.
 *
 * Le Kanban utilisait l'API HTML5 `draggable`/`onDrop`, qui n'existe pas sur
 * tactile : la page l'admettait elle-même (« ordinateur uniquement ») et il
 * fallait ouvrir la fiche pour changer un statut depuis une tablette. Les
 * événements pointeur couvrent les deux.
 *
 * Le geste part d'une poignée dédiée plutôt que de la carte entière : c'est
 * elle seule qui porte `touch-action: none`, si bien que la colonne continue
 * de défiler normalement au doigt et qu'un appui sur la carte ouvre toujours
 * la tâche.
 */
export function useCardDrag(onDrop: (id: string, zone: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (!drag) return;

    function zoneAt(x: number, y: number) {
      const el = document.elementFromPoint(x, y)?.closest(`[${DROP_ZONE_ATTR}]`);
      return el?.getAttribute(DROP_ZONE_ATTR) ?? null;
    }
    function onMove(e: PointerEvent) {
      e.preventDefault();
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: zoneAt(e.clientX, e.clientY) } : d));
    }
    function onUp(e: PointerEvent) {
      const zone = zoneAt(e.clientX, e.clientY);
      setDrag((d) => {
        if (d && zone) onDrop(d.id, zone);
        return null;
      });
    }
    function onCancel() {
      setDrag(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [drag, onDrop]);

  return {
    drag,
    start: (id: string, label: string, e: { clientX: number; clientY: number }) =>
      setDrag({ id, label, x: e.clientX, y: e.clientY, over: null }),
    zoneAttrs: (zone: string) => ({ [DROP_ZONE_ATTR]: zone }),
  };
}
