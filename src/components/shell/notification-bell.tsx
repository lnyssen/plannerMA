"use client";

import type { Notification, NotificationType } from "@prisma/client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/lib/actions/notifications";
import { quandFr } from "@/lib/planning/dates";
import { iconButtonOnRailClass, textButtonClass } from "@/components/ui/buttons";

// Utilisée sur la barre latérale et l'en-tête mobile, toutes deux sur le
// fond violet foncé --color-rail : une seule variante d'icône suffit.

const POLL_MS = 30_000;
const PANEL_WIDTH = 360;
const VIEWPORT_MARGIN = 12;

const TYPE_LABEL: Record<NotificationType, string> = {
  ASSIGNMENT: "Attribution",
  MENTION: "Mention",
  REQUEST: "Demande",
  BUDGET_EXCEEDED: "Budget dépassé",
  PROJECT_BEHIND: "Rythme budgétaire",
  MILESTONE_LATE: "Date clé dépassée",
  COMMENT: "Commentaire",
};

// Regroupement visuel par nature plutôt qu'une couleur par type : "quelqu'un
// vous a écrit" (mention/commentaire) en Rose Poudré, "quelque chose arrive
// dans votre file" (attribution/demande) en Bleu Clair — deux couleurs de la
// charte, déjà les jetons --color-alert-wash/--color-line (voir
// client-type-badge.tsx). Les alertes budgétaires restent en rouge alerte
// plein, seule vraie urgence du lot.
const TYPE_BADGE_BG: Record<NotificationType, string> = {
  MENTION: "var(--color-alert-wash)",
  COMMENT: "var(--color-alert-wash)",
  ASSIGNMENT: "var(--color-line)",
  REQUEST: "var(--color-line)",
  BUDGET_EXCEEDED: "color-mix(in srgb, var(--color-alert) 16%, transparent)",
  PROJECT_BEHIND: "color-mix(in srgb, var(--color-alert) 16%, transparent)",
  MILESTONE_LATE: "color-mix(in srgb, var(--color-alert) 16%, transparent)",
};

const TYPE_BADGE_TEXT: Record<NotificationType, string> = {
  MENTION: "var(--color-ink-muted)",
  COMMENT: "var(--color-ink-muted)",
  ASSIGNMENT: "var(--color-ink-muted)",
  REQUEST: "var(--color-ink-muted)",
  BUDGET_EXCEEDED: "var(--color-alert)",
  MILESTONE_LATE: "var(--color-alert)",
  PROJECT_BEHIND: "var(--color-alert)",
};

export function NotificationBell() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Positionné en `fixed` avec des coordonnées calculées au clic plutôt qu'en
  // `absolute right-0` : la barre latérale a `overflow-y-auto` (nécessaire
  // pour un long menu sur un petit écran), ce qui force aussi `overflow-x`
  // implicitement (règle CSS : un seul axe non-`visible` bascule l'autre en
  // `auto`) — un panneau plus large que la colonne de 260 px se retrouvait
  // tronqué au lieu de simplement déborder. `position: fixed` échappe à ce
  // clip d'ancêtre (aucun des parents n'a de transform/filter).
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const n = await unreadNotificationCount();
      if (!cancelled) setCount(n);
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function computeCoords() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(
      Math.max(rect.right - PANEL_WIDTH, VIEWPORT_MARGIN),
      window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN,
    );
    setCoords({ top: rect.bottom + 8, left });
  }

  useEffect(() => {
    if (!open) return;
    computeCoords();
    window.addEventListener("resize", computeCoords);
    return () => window.removeEventListener("resize", computeCoords);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      const list = await listNotifications();
      setItems(list);
      setLoaded(true);
    }
  }

  async function onClickItem(n: Notification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  }

  async function onMarkAll() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setCount(0);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className={`relative flex h-7 w-7 items-center justify-center ${iconButtonOnRailClass}`}
      >
        <Bell size={20} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold text-white tabular-nums ring-2 ring-rail"
            aria-label={`${count} non lues`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && coords && (
        <>
          <button type="button" aria-label="Fermer" className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="fixed z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-[0_16px_40px_-12px_rgba(68,68,68,0.3)]"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Notifications</span>
              {items.some((n) => !n.read) && (
                <button type="button" onClick={onMarkAll} className={`text-xs font-semibold text-heading ${textButtonClass}`}>
                  Tout marquer lu
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-muted">Aucune notification.</p>
            ) : (
              // Le défilement porte sur la liste seule : l'en-tête et « Tout
              // marquer lu » restent atteignables quand la liste est longue.
              <div className="divide-y divide-line overflow-y-auto">
                {items.map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => onClickItem(n)}
                    // Le non-lu se signale par un filet à gauche sur un fond
                    // très clair : l'aplat --color-tint qu'on avait avant
                    // couvrait toute la ligne et rendait le message pénible à
                    // lire, alors qu'il ne s'agit que de dire « celle-ci est
                    // nouvelle ».
                    className="flex flex-col gap-1 border-l-[3px] px-4 py-3 text-left transition-colors duration-100 hover:bg-wash active:bg-line"
                    style={{
                      borderLeftColor: n.read ? "transparent" : "var(--color-heading)",
                      background: n.read ? "transparent" : "var(--color-wash)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-2xs font-semibold tracking-wide uppercase"
                        style={{ background: TYPE_BADGE_BG[n.type], color: TYPE_BADGE_TEXT[n.type] }}
                      >
                        {TYPE_LABEL[n.type]}
                      </span>
                      <span className="text-2xs text-ink-muted">{quandFr(n.createdAt)}</span>
                    </span>
                    <span className="text-sm leading-snug text-ink">{n.message}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
