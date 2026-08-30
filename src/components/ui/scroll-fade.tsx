"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Enveloppe un conteneur à défilement horizontal d'un dégradé au bord droit,
 * visible seulement s'il reste du contenu à faire défiler — un filet de
 * défilement seul (voir Tâches sur mobile avant ce correctif) ne suffisait
 * pas à signaler qu'il y avait plus de colonnes hors champ.
 */
export function ScrollFade({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  function update() {
    const el = ref.current;
    if (!el) return;
    setShowFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
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
  }, []);

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className={`overflow-x-auto ${className}`}>
        {children}
      </div>
      {showFade && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 w-8"
          style={{ background: "linear-gradient(to right, transparent, var(--color-paper))" }}
        />
      )}
    </div>
  );
}
