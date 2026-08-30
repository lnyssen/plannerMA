"use client";

import type { Notification, NotificationType } from "@prisma/client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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

const TYPE_LABEL: Record<NotificationType, string> = {
  ASSIGNMENT: "Attribution",
  MENTION: "Mention",
  REQUEST: "Demande",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);

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
      <button type="button" onClick={toggle} aria-label="Notifications" className={`relative p-1 ${iconButtonOnRailClass}`}>
        <Bell size={20} />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center bg-alert px-1 text-[10px] font-bold text-white"
            aria-label={`${count} non lues`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Fermer" className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 max-h-[70vh] w-80 overflow-y-auto border border-heading bg-paper shadow-none">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Notifications</span>
              {items.some((n) => !n.read) && (
                <button type="button" onClick={onMarkAll} className={`text-xs font-semibold text-heading ${textButtonClass}`}>
                  Tout marquer lu
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-muted">Aucune notification.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => onClickItem(n)}
                  className="flex flex-col gap-0.5 border-b border-line px-3 py-2.5 text-left transition-colors duration-100 hover:bg-wash active:bg-tint"
                  style={{ background: n.read ? "transparent" : "var(--color-tint)" }}
                >
                  <span className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">
                    {TYPE_LABEL[n.type]} · {quandFr(n.createdAt)}
                  </span>
                  <span className="text-sm text-ink">{n.message}</span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
