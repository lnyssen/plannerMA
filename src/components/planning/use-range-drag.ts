"use client";

import { useEffect, useState } from "react";

/** Attribut posé sur chaque cellule sélectionnable, au format `<ligne>|<index>`. */
export const RANGE_CELL_ATTR = "data-range-cell";

export interface RangeDragSelection {
  rowKey: string;
  from: number;
  to: number;
}

/**
 * Sélection d'une plage de colonnes par glissement, sur une seule ligne —
 * le geste « je tire du lundi au mercredi sur la ligne de Chloé » des vues
 * Semaine et Gantt, qui ouvre ensuite la création avec la personne et les
 * dates déjà remplies.
 *
 * Le suivi passe par `document.elementFromPoint` plutôt que par des
 * `onPointerEnter` posés sur chaque cellule : dès qu'un pointeur est capturé
 * (et il l'est au premier `pointerdown` sur mobile), les événements d'entrée
 * des autres cellules ne partent plus. Chercher la cellule sous le pointeur
 * à chaque déplacement marche à la souris comme au doigt, sans capture.
 *
 * Le geste ne quitte jamais la ligne où il a commencé : une plage s'étale
 * sur des dates, pas sur des personnes ni des projets.
 */
export function useRangeDrag(onCommit: (selection: RangeDragSelection) => void) {
  const [raw, setRaw] = useState<{ rowKey: string; a: number; b: number } | null>(null);

  useEffect(() => {
    if (!raw) return;

    function cellAt(x: number, y: number) {
      const el = document.elementFromPoint(x, y)?.closest(`[${RANGE_CELL_ATTR}]`);
      const value = el?.getAttribute(RANGE_CELL_ATTR);
      if (!value) return null;
      const sep = value.lastIndexOf("|");
      return { rowKey: value.slice(0, sep), index: Number(value.slice(sep + 1)) };
    }

    function onMove(e: PointerEvent) {
      // Sans ça, le glissement sélectionne le texte des cellules à la souris
      // et fait défiler la page au doigt.
      e.preventDefault();
      const cell = cellAt(e.clientX, e.clientY);
      if (cell && raw && cell.rowKey === raw.rowKey) setRaw((r) => (r ? { ...r, b: cell.index } : r));
    }
    function onUp() {
      if (raw) onCommit({ rowKey: raw.rowKey, from: Math.min(raw.a, raw.b), to: Math.max(raw.a, raw.b) });
      setRaw(null);
    }
    function onCancel() {
      setRaw(null);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };
  }, [raw, onCommit]);

  return {
    selection: raw ? { rowKey: raw.rowKey, from: Math.min(raw.a, raw.b), to: Math.max(raw.a, raw.b) } : null,
    start: (rowKey: string, index: number) => setRaw({ rowKey, a: index, b: index }),
    /** À étaler sur chaque cellule pour que le suivi la retrouve sous le pointeur. */
    cellAttrs: (rowKey: string, index: number) => ({ [RANGE_CELL_ATTR]: `${rowKey}|${index}` }),
  };
}
