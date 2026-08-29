"use client";

import type { Role } from "@prisma/client";
import { Calendar, Inbox, ListChecks, Menu, Plus, Settings, Users, User as UserIcon, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { StudioSummary } from "@/lib/data/studios";
import { signOutAction } from "./actions";

const NAV_ENTRIES = [
  { href: "/mes-taches", label: "Mes tâches", icon: UserIcon, adminOnly: false },
  { href: "/projets", label: "Projets", icon: ListChecks, adminOnly: false },
  { href: "/planning", label: "Planning", icon: Calendar, adminOnly: false },
  { href: "/demandes", label: "Demandes", icon: Inbox, adminOnly: false },
  { href: "/equipe", label: "Équipe", icon: Users, adminOnly: false },
  { href: "/reglages", label: "Réglages", icon: Settings, adminOnly: true },
] as const;

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  STUDIO_LEAD: "Responsable de studio",
  COLLABORATOR: "Collaborateur",
};

interface AppShellProps {
  studios: StudioSummary[];
  userName: string;
  role: Role;
  pendingRequestsCount: number;
  children: React.ReactNode;
}

export function AppShell({ studios, userName, role, pendingRequestsCount, children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Filtre studio : état d'affichage local pour l'instant. Le brancher sur
  // les vues Projets/Planning viendra avec ces vues (palier 3), pas avant —
  // pas de contexte partagé prématuré tant qu'il n'y a rien à filtrer.
  const [activeStudios, setActiveStudios] = useState<Set<string>>(
    () => new Set(studios.map((s) => s.id)),
  );

  function toggleStudio(id: string) {
    setActiveStudios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id); // toujours garder au moins un studio actif
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {NAV_ENTRIES.filter((e) => !e.adminOnly || role === "ADMIN").map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawerOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm ${
              active
                ? "bg-white font-semibold text-rail"
                : "font-normal text-rail-contrast hover:bg-white/10"
            }`}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
            {href === "/demandes" && pendingRequestsCount > 0 && (
              <span
                className={`ml-auto px-1.5 text-xs font-bold ${
                  active ? "bg-rail text-white" : "bg-white text-rail"
                }`}
              >
                {pendingRequestsCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const railContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="font-[family-name:var(--font-display)] text-lg font-semibold leading-tight text-rail-contrast">
          Média Animation
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="text-rail-contrast md:hidden"
          aria-label="Fermer le menu"
        >
          <X size={22} />
        </button>
      </div>
      <p className="mt-1 text-xs text-rail-contrast/80">{ROLE_LABEL[role]}</p>

      <div className="my-4 h-px bg-white/25" />

      {nav}

      <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-rail-contrast/75">
        Studios
      </p>
      <ul className="flex flex-col gap-2">
        {studios.map((studio) => {
          const checked = activeStudios.has(studio.id);
          return (
            <li key={studio.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-rail-contrast">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStudio(studio.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 text-[10px] font-bold text-white"
                  style={{
                    borderColor: checked ? studio.colorHex : "rgba(255,255,255,0.5)",
                    background: checked ? studio.colorHex : "transparent",
                  }}
                >
                  {checked ? studio.initial : ""}
                </span>
                {studio.name}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex-1" />

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/projets"
          className="flex h-10 items-center justify-center gap-1.5 bg-white text-sm font-semibold text-rail"
        >
          <Plus size={16} /> Nouveau projet
        </Link>
        <Link
          href="/projets"
          className="flex h-10 items-center justify-center gap-1.5 border border-white/50 text-sm font-medium text-rail-contrast"
        >
          <Plus size={16} /> Nouvelle tâche
        </Link>
      </div>

      <p className="mt-6 truncate text-sm text-rail-contrast">{userName}</p>
      <form action={signOutAction} className="mt-1">
        <button
          type="submit"
          className="text-left text-xs font-medium text-rail-contrast/80 underline-offset-2 hover:underline"
        >
          Se déconnecter
        </button>
      </form>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden bg-rail px-5 py-5 md:sticky md:top-0 md:flex md:h-screen md:w-[264px] md:flex-shrink-0 md:flex-col md:overflow-y-auto">
        {railContent}
      </aside>

      <header className="flex h-14 items-center justify-between bg-rail px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="text-rail-contrast"
        >
          <Menu size={24} />
        </button>
        <span className="font-[family-name:var(--font-display)] text-base font-semibold text-rail-contrast">
          Média Animation
        </span>
        <Link
          href="/projets"
          aria-label="Nouveau projet"
          className="flex h-9 w-9 items-center justify-center bg-white text-rail"
        >
          <Plus size={18} />
        </Link>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/50"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col overflow-y-auto bg-rail px-5 py-5">
            {railContent}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
