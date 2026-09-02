"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Enveloppe un conteneur défilant d'un dégradé au bord où il reste du
 * contenu hors champ — un filet de défilement seul (voir Tâches sur mobile
 * avant ce correctif) ne suffisait pas à signaler qu'il y avait plus de
 * colonnes à droite.
 *
 * Les deux bords sont traités : sans dégradé au bord d'amont, une liste déjà
 * défilée ne dit plus qu'il y a du contenu au-dessus (ou à gauche). Et l'axe
 * est réglable, parce que le même défaut se produisait verticalement dans le
 * menu de gauche, dont la dernière entrée était tranchée net par le bord de
 * la zone défilante — ce qui se lit comme un bug d'affichage, pas comme « il
 * y a la suite plus bas ».
 */
export function ScrollFade({
  children,
  className = "",
  axis = "x",
  /** Couleur du fond derrière le conteneur, vers laquelle le dégradé se fond. */
  fadeTo = "var(--color-paper)",
}: {
  children: React.ReactNode;
  className?: string;
  axis?: "x" | "y";
  fadeTo?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fades, setFades] = useState({ start: false, end: false });

  function update() {
    const el = ref.current;
    if (!el) return;
    const [pos, size, client] =
      axis === "x"
        ? [el.scrollLeft, el.scrollWidth, el.clientWidth]
        : [el.scrollTop, el.scrollHeight, el.clientHeight];
    setFades({ start: pos > 4, end: size - client - pos > 4 });
  }

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    // Observer le conteneur seul ne suffit pas : son propre cadre ne change
    // pas quand c'est le CONTENU qui s'élargit (ex. Charge passant de 8 à 12
    // semaines) — observer aussi le premier enfant pour capter ce cas.
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` est recréé à chaque rendu mais ne lit que des refs et `axis`, stable pour une instance donnée.
  }, [axis]);

  const band = axis === "x" ? "top-0 bottom-0 w-8" : "left-0 right-0 h-8";

  return (
    <div className={`relative ${axis === "y" ? "flex min-h-0 flex-col" : ""}`}>
      <div
        ref={ref}
        onScroll={update}
        className={`${axis === "x" ? "overflow-x-auto" : "min-h-0 flex-1 overflow-y-auto"} ${className}`}
      >
        {children}
      </div>
      {fades.start && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-20 ${band} ${axis === "x" ? "left-0" : "top-0"}`}
          style={{ background: `linear-gradient(to ${axis === "x" ? "left" : "top"}, transparent, ${fadeTo})` }}
        />
      )}
      {fades.end && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-20 ${band} ${axis === "x" ? "right-0" : "bottom-0"}`}
          style={{ background: `linear-gradient(to ${axis === "x" ? "right" : "bottom"}, transparent, ${fadeTo})` }}
        />
      )}
    </div>
  );
}
