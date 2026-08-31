"use client";

import type { Role } from "@prisma/client";
import type { ThemePreference } from "@prisma/client";
import {
  ArrowUpDown,
  Bell,
  ClipboardPlus,
  FolderPlus,
  ListPlus,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { updateThemePreference } from "@/lib/actions/account";
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
import { applyNavOrder, NAV_ENTRIES, type NavCounts } from "./nav-entries";
import { NotificationBell } from "./notification-bell";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  STUDIO_LEAD: "Responsable de studio",
  COLLABORATOR: "Collaborateur",
};

// Préférence purement locale (repliée ou non) : pas de sens à la
// synchroniser entre appareils, contrairement à navOrder (compte) — même
// registre que la bascule Cartes/Tableau de Projets.
const COLLAPSE_STORAGE_KEY = "planning-studios:nav-collapsed";

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
  theme: ThemePreference;
  counts: NavCounts;
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
  theme,
  counts,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<"task" | "project" | "request" | "notifications" | "navOrder" | null>(null);
  const [collapsed, setCollapsedState] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(theme);

  function toggleTheme() {
    const next: ThemePreference = currentTheme === "DARK" ? "LIGHT" : "DARK";
    // Application immédiate côté client (pas d'attente du round-trip
    // serveur) — la valeur en base suit derrière et sera relue au prochain
    // chargement complet de page (voir app/layout.tsx, qui pose data-theme
    // avant le premier rendu pour éviter un flash).
    document.documentElement.dataset.theme = next.toLowerCase();
    setCurrentTheme(next);
    void updateThemePreference(next);
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      // Lecture possible seulement après montage (pas de localStorage côté
      // serveur) — voir la même justification sur la bascule Cartes/Tableau.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "1") setCollapsedState(true);
    } catch {
      // localStorage indisponible — reste déplié.
    }
  }, []);

  function setCollapsed(next: boolean) {
    setCollapsedState(next);
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Rien à faire : la préférence ne survivra juste pas à cette session.
    }
  }

  const orderedEntries = applyNavOrder(
    NAV_ENTRIES.filter((e) => !e.adminOnly || role === "ADMIN"),
    navOrder,
  );

  function renderNav(isCollapsed: boolean) {
    return (
      <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 border-b border-white/15 px-3 pb-3">
        {orderedEntries.map(({ href, label, icon: Icon, countKey }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const count = countKey ? counts[countKey] : 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setDrawerOpen(false)}
              aria-current={active ? "page" : undefined}
              title={isCollapsed ? (count > 0 ? `${label} (${count})` : label) : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-sm leading-5 transition-colors duration-100 hover:bg-white/10 active:bg-white/20 ${isCollapsed ? "justify-center" : ""}`}
              style={{
                background: active ? "rgba(255,255,255,0.18)" : "transparent",
                color: active ? "#FFFFFF" : "rgba(255,255,255,0.85)",
                fontWeight: active ? 700 : 600,
              }}
            >
              <Icon size={17} aria-hidden="true" className="flex-shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
              {!isCollapsed && count > 0 && (
                <span className="flex-shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-2xs font-bold text-white tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  function renderRail(isCollapsed: boolean, showCollapseToggle: boolean) {
    return (
      <>
        <div className={`flex items-start gap-2 px-5 pt-5 pb-5 ${isCollapsed ? "flex-col items-center" : "justify-between"}`}>
          {!isCollapsed && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo bitmap fourni tel quel, pas d'optimisation next/image nécessaire pour cette taille */}
              <img src="/logo/media-animation-blanc.png" alt="Média Animation" className="h-8 w-auto" />
              <div className="mt-1.5 text-sm text-white/70">Studio planner</div>
            </div>
          )}
          <div className={`flex items-center gap-1 ${isCollapsed ? "flex-col" : ""}`}>
            {!isCollapsed && (
              <>
                <GlobalSearch />
                <NotificationBell />
              </>
            )}
            {showCollapseToggle && (
              <button
                type="button"
                onClick={() => setCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Déplier le menu" : "Replier le menu"}
                title={isCollapsed ? "Déplier le menu" : "Replier le menu"}
                className={`hidden md:block ${iconButtonOnRailClass}`}
              >
                {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              </button>
            )}
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

        {renderNav(isCollapsed)}

        <div className="flex-1" />

        <div className={`flex flex-col gap-2.5 px-3 pt-4 pb-4 ${isCollapsed ? "items-center" : ""}`}>
          <button
            type="button"
            onClick={() => {
              setModal("task");
              setDrawerOpen(false);
            }}
            title="Nouvelle tâche"
            className={`flex h-10 items-center justify-center gap-1.5 text-[15px] font-bold ${primaryOnRailButtonClass} ${isCollapsed ? "w-10 px-0" : "w-full"}`}
          >
            <ListPlus size={17} /> {!isCollapsed && "Nouvelle tâche"}
          </button>
          <button
            type="button"
            onClick={() => {
              setModal("project");
              setDrawerOpen(false);
            }}
            title="Nouveau projet"
            className={`flex h-10 items-center justify-center gap-1.5 text-[15px] font-bold ${secondaryOnRailButtonClass} ${isCollapsed ? "w-10 px-0" : "w-full"}`}
          >
            <FolderPlus size={17} /> {!isCollapsed && "Nouveau projet"}
          </button>
          <button
            type="button"
            onClick={() => {
              setModal("request");
              setDrawerOpen(false);
            }}
            title="Nouvelle demande"
            className={`flex items-center justify-center gap-1.5 text-xs font-semibold text-white/80 ${textButtonClass}`}
          >
            <ClipboardPlus size={13} aria-hidden="true" /> {!isCollapsed && "Nouvelle demande"}
          </button>
        </div>

        <div className={`px-3 pt-2 pb-5 ${isCollapsed ? "flex flex-col items-center gap-2" : "px-5"}`}>
          {!isCollapsed && (
            <>
              <p className="mb-1 truncate text-sm text-white">{userName}</p>
              <p className="mb-2 text-xs text-white/70">{ROLE_LABEL[role]}</p>
            </>
          )}
          <button
            type="button"
            onClick={() => setModal("notifications")}
            title="Mes notifications"
            className={`flex items-center gap-1.5 text-xs font-medium text-white/80 ${isCollapsed ? "justify-center rounded-md p-1.5 hover:bg-white/10" : "mb-2 text-left underline-offset-2 hover:underline"} ${textButtonClass}`}
          >
            <Bell size={13} aria-hidden="true" /> {!isCollapsed && "Mes notifications"}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title={currentTheme === "DARK" ? "Passer au thème clair" : "Passer au thème sombre"}
            className={`flex items-center gap-1.5 text-xs font-medium text-white/80 ${isCollapsed ? "justify-center rounded-md p-1.5 hover:bg-white/10" : "mb-2 text-left underline-offset-2 hover:underline"} ${textButtonClass}`}
          >
            {currentTheme === "DARK" ? (
              <Sun size={13} aria-hidden="true" />
            ) : (
              <Moon size={13} aria-hidden="true" />
            )}{" "}
            {!isCollapsed && (currentTheme === "DARK" ? "Thème clair" : "Thème sombre")}
          </button>
          <button
            type="button"
            onClick={() => setModal("navOrder")}
            title="Réorganiser le menu"
            className={`flex items-center gap-1.5 text-xs font-medium text-white/80 ${isCollapsed ? "justify-center rounded-md p-1.5 hover:bg-white/10" : "mb-2 text-left underline-offset-2 hover:underline"} ${textButtonClass}`}
          >
            <ArrowUpDown size={13} aria-hidden="true" /> {!isCollapsed && "Réorganiser le menu"}
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              title="Se déconnecter"
              className={`flex items-center gap-1.5 text-xs font-medium text-white/80 ${isCollapsed ? "justify-center rounded-md p-1.5 hover:bg-white/10" : "text-left underline-offset-2 hover:underline"}`}
            >
              <LogOut size={13} aria-hidden="true" /> {!isCollapsed && "Se déconnecter"}
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        className={`hidden bg-rail transition-[width] duration-150 md:sticky md:top-0 md:flex md:h-screen md:flex-shrink-0 md:flex-col md:overflow-y-auto md:overflow-x-hidden ${collapsed ? "md:w-[76px]" : "md:w-[260px]"}`}
      >
        {renderRail(collapsed, true)}
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
            <ListPlus size={18} />
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
            {renderRail(false, false)}
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
