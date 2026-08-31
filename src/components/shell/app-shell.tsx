"use client";

import type { Role } from "@prisma/client";
import { ArrowUpDown, Bell, LogOut, Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CreateProjectModal } from "@/components/modals/create-project-modal";
import { CreateTaskModal } from "@/components/modals/create-task-modal";
import { NavOrderModal } from "@/components/modals/nav-order-modal";
import { NotificationPrefsModal } from "@/components/modals/notification-prefs-modal";
import { RequestModal } from "@/components/modals/request-modal";
import { iconButtonOnRailClass, primaryOnRailButtonClass, secondaryOnRailButtonClass, textButtonClass } from "@/components/ui/buttons";
import type { ClientSummary } from "@/lib/data/clients";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskOption } from "@/lib/data/tasks";
import { signOutAction } from "./actions";
import { GlobalSearch } from "./global-search";
import { applyNavOrder, NAV_ENTRIES } from "./nav-entries";
import { NotificationBell } from "./notification-bell";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  STUDIO_LEAD: "Responsable de studio",
  COLLABORATOR: "Collaborateur",
};

interface AppShellProps {
  studios: StudioSummary[];
  people: PersonSummary[];
  projects: ProjectOption[];
  clients: ClientSummary[];
  tasks: TaskOption[];
  userName: string;
  role: Role;
  notifyOnAssignment: boolean;
  notifyDailyDigest: boolean;
  navOrder: string[] | null;
  children: React.ReactNode;
}

export function AppShell({
  studios,
  people,
  projects,
  clients,
  tasks,
  userName,
  role,
  notifyOnAssignment,
  notifyDailyDigest,
  navOrder,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<"task" | "project" | "request" | "notifications" | "navOrder" | null>(null);

  const orderedEntries = applyNavOrder(
    NAV_ENTRIES.filter((e) => !e.adminOnly || role === "ADMIN"),
    navOrder,
  );

  const nav = (
    <nav aria-label="Navigation principale" className="flex flex-col border-b border-white/15 pb-3">
      {orderedEntries.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawerOpen(false)}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-2.5 border-l-[3px] px-5 py-2 font-[family-name:var(--font-body)] text-sm leading-5 transition-colors duration-100 hover:bg-white/10 active:bg-white/20"
            style={{
              borderLeftColor: active ? "#FFFFFF" : "transparent",
              background: active ? "rgba(255,255,255,0.1)" : "transparent",
              color: active ? "#FFFFFF" : "rgba(255,255,255,0.85)",
              fontWeight: active ? 700 : 600,
            }}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const railContent = (
    <>
      <div className="flex items-start justify-between gap-2 px-5 pt-5 pb-5">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- logo bitmap fourni tel quel, pas d'optimisation next/image nécessaire pour cette taille */}
          <img src="/logo/media-animation-blanc.png" alt="Média Animation" className="h-8 w-auto" />
          <div className="mt-1.5 text-sm text-white/70">Studio planner</div>
        </div>
        <div className="flex items-center gap-1">
          <GlobalSearch />
          <NotificationBell />
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className={`md:hidden ${iconButtonOnRailClass}`}
            aria-label="Fermer le menu"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {nav}

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 px-5 pt-4 pb-4">
        <button
          type="button"
          onClick={() => {
            setModal("task");
            setDrawerOpen(false);
          }}
          className={`flex h-10 items-center justify-center gap-1.5 text-[15px] font-bold ${primaryOnRailButtonClass}`}
        >
          <Plus size={17} /> Nouvelle tâche
        </button>
        <button
          type="button"
          onClick={() => {
            setModal("project");
            setDrawerOpen(false);
          }}
          className={`flex h-10 items-center justify-center gap-1.5 text-[15px] font-bold ${secondaryOnRailButtonClass}`}
        >
          <Plus size={17} /> Nouveau projet
        </button>
        <button
          type="button"
          onClick={() => {
            setModal("request");
            setDrawerOpen(false);
          }}
          className={`flex items-center justify-center gap-1.5 text-xs font-semibold text-white/80 ${textButtonClass}`}
        >
          <Plus size={13} aria-hidden="true" /> Nouvelle demande
        </button>
      </div>

      <div className="px-5 pt-2 pb-5">
        <p className="mb-1 truncate text-sm text-white">{userName}</p>
        <p className="mb-2 text-xs text-white/70">{ROLE_LABEL[role]}</p>
        <button
          type="button"
          onClick={() => setModal("notifications")}
          className={`mb-2 flex items-center gap-1.5 text-left text-xs font-medium text-white/80 underline-offset-2 hover:underline ${textButtonClass}`}
        >
          <Bell size={13} aria-hidden="true" /> Mes notifications
        </button>
        <button
          type="button"
          onClick={() => setModal("navOrder")}
          className={`mb-2 flex items-center gap-1.5 text-left text-xs font-medium text-white/80 underline-offset-2 hover:underline ${textButtonClass}`}
        >
          <ArrowUpDown size={13} aria-hidden="true" /> Réorganiser le menu
        </button>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-left text-xs font-medium text-white/80 underline-offset-2 hover:underline"
          >
            <LogOut size={13} aria-hidden="true" /> Se déconnecter
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden bg-rail md:sticky md:top-0 md:flex md:h-screen md:w-[260px] md:flex-shrink-0 md:flex-col md:overflow-y-auto">
        {railContent}
      </aside>

      <header className="flex h-14 items-center justify-between bg-rail px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className={iconButtonOnRailClass}
        >
          <Menu size={24} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo bitmap fourni tel quel */}
        <img src="/logo/media-animation-blanc.png" alt="Média Animation" className="h-6 w-auto" />
        <div className="flex items-center gap-1">
          <GlobalSearch />
          <NotificationBell />
          <button
            type="button"
            onClick={() => setModal("task")}
            aria-label="Nouvelle tâche"
            className={`flex h-9 w-9 items-center justify-center ${primaryOnRailButtonClass}`}
          >
            <Plus size={18} />
          </button>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-rail/70"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col overflow-y-auto bg-rail">
            {railContent}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">{children}</main>

      {modal === "task" && (
        <CreateTaskModal
          studios={studios}
          projects={projects}
          people={people}
          tasks={tasks}
          onClose={() => setModal(null)}
          onCreated={() => setModal(null)}
        />
      )}
      {modal === "project" && (
        <CreateProjectModal
          studios={studios}
          clients={clients}
          onClose={() => setModal(null)}
          onCreated={() => setModal(null)}
        />
      )}
      {modal === "request" && <RequestModal studios={studios} onClose={() => setModal(null)} />}
      {modal === "notifications" && (
        <NotificationPrefsModal
          initialNotifyOnAssignment={notifyOnAssignment}
          initialNotifyDailyDigest={notifyDailyDigest}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "navOrder" && <NavOrderModal role={role} initialOrder={navOrder} onClose={() => setModal(null)} />}
    </div>
  );
}
