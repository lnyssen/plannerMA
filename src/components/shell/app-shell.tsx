"use client";

import type { Role } from "@prisma/client";
import type { ThemePreference } from "@prisma/client";
import {
  ArrowUpDown,
  Bell,
  ChevronUp,
  ClipboardPlus,
  FolderPlus,
  KeyRound,
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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { updateThemePreference } from "@/lib/actions/account";
import { ChangePasswordModal } from "@/components/modals/change-password-modal";
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
import { CommandPalette } from "./command-palette";
import { CreateModalsProvider } from "./create-modals-context";
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
  notifyOnMention: boolean;
  notifyOnRequest: boolean;
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
  notifyOnMention,
  notifyOnRequest,
  navOrder,
  theme,
  counts,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<"task" | "project" | "request" | "notifications" | "navOrder" | "password" | null>(null);
  const [collapsed, setCollapsedState] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(theme);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [userMenuOpen]);

  const userInitial = userName.trim().charAt(0).toUpperCase() || "?";

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
    // Les intitulés de groupe n'ont de sens que pour l'ordre par défaut : dès
    // qu'un ordre personnalisé existe, les entrées peuvent mélanger les
    // groupes (voir applyNavOrder), un intitulé y serait trompeur.
    const showGroups = !navOrder || navOrder.length === 0;
    let lastGroup: string | null = null;
    return (
      <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 border-b border-white/15 px-3 pb-3">
        {orderedEntries.map(({ href, label, icon: Icon, countKey, group }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const count = countKey ? counts[countKey] : 0;
          const showGroupLabel = showGroups && !isCollapsed && group !== lastGroup;
          lastGroup = group;
          return (
            <div key={href}>
              {showGroupLabel && (
                <p className={`px-3 text-2xs font-bold tracking-wide text-white/50 uppercase ${href === orderedEntries[0].href ? "pb-1.5" : "pt-3 pb-1.5"}`}>
                  {group}
                </p>
              )}
              <Link
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
            </div>
          );
        })}
      </nav>
    );
  }

  function renderRail(isCollapsed: boolean, showCollapseToggle: boolean) {
    return (
      <>
        <div className={`flex flex-shrink-0 items-start gap-2 px-5 pt-5 pb-5 ${isCollapsed ? "flex-col items-center" : "justify-between"}`}>
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
                className={`hidden h-7 w-7 items-center justify-center md:flex ${iconButtonOnRailClass}`}
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

        {/* Seule cette zone défile : les boutons d'action et le menu profil
            en dessous restent toujours visibles, même si la liste de
            navigation dépasse la hauteur de l'écran. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{renderNav(isCollapsed)}</div>

        <div className={`flex flex-shrink-0 flex-col gap-2.5 px-3 pt-4 pb-4 ${isCollapsed ? "items-center" : ""}`}>
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

        <div ref={userMenuRef} className={`relative flex-shrink-0 px-3 pb-5 ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          {userMenuOpen && (
            <div
              className={`absolute z-20 overflow-hidden rounded-lg border border-white/20 shadow-xl ${
                isCollapsed ? "bottom-0 left-full ml-2 w-56" : "right-3 bottom-full left-3 mb-2"
              }`}
              style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
            >
              <div className="px-3 pt-3 pb-2">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="text-xs text-white/60">{ROLE_LABEL[role]}</p>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 pb-2">
                <span className="text-xs font-medium text-white/70">Thème</span>
                <div className="flex overflow-hidden rounded-md border border-white/20">
                  <button
                    type="button"
                    onClick={() => currentTheme !== "LIGHT" && toggleTheme()}
                    aria-label="Thème clair"
                    aria-pressed={currentTheme === "LIGHT"}
                    className="flex h-7 w-8 items-center justify-center transition-colors duration-100"
                    style={{ background: currentTheme === "LIGHT" ? "rgba(255,255,255,0.9)" : "transparent" }}
                  >
                    <Sun size={14} color={currentTheme === "LIGHT" ? "var(--color-rail)" : "rgba(255,255,255,0.7)"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => currentTheme !== "DARK" && toggleTheme()}
                    aria-label="Thème sombre"
                    aria-pressed={currentTheme === "DARK"}
                    className="flex h-7 w-8 items-center justify-center border-l border-white/20 transition-colors duration-100"
                    style={{ background: currentTheme === "DARK" ? "rgba(255,255,255,0.9)" : "transparent" }}
                  >
                    <Moon size={14} color={currentTheme === "DARK" ? "var(--color-rail)" : "rgba(255,255,255,0.7)"} />
                  </button>
                </div>
              </div>
              <div className="border-t border-white/10 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setModal("password");
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-white/85 transition-colors duration-100 hover:bg-white/10"
                >
                  <KeyRound size={15} aria-hidden="true" /> Changer de mot de passe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModal("notifications");
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-white/85 transition-colors duration-100 hover:bg-white/10"
                >
                  <Bell size={15} aria-hidden="true" /> Mes notifications
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModal("navOrder");
                    setUserMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-white/85 transition-colors duration-100 hover:bg-white/10"
                >
                  <ArrowUpDown size={15} aria-hidden="true" /> Réorganiser le menu
                </button>
              </div>
              <form action={signOutAction} className="border-t border-white/10 py-1.5">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium text-white/85 transition-colors duration-100 hover:bg-white/10"
                >
                  <LogOut size={15} aria-hidden="true" /> Déconnexion
                </button>
              </form>
            </div>
          )}

          <button
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            title={userName}
            className={`flex items-center gap-2.5 rounded-lg border p-2 transition-colors duration-100 hover:bg-white/10 ${isCollapsed ? "justify-center" : "w-full text-left"}`}
            style={{ borderColor: userMenuOpen ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-rail">
              {userInitial}
            </span>
            {!isCollapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{userName}</span>
                <ChevronUp
                  size={14}
                  className={`flex-shrink-0 text-white/60 transition-transform duration-150 ${userMenuOpen ? "" : "rotate-180"}`}
                  aria-hidden="true"
                />
              </>
            )}
          </button>
        </div>
      </>
    );
  }

  return (
    <CreateModalsProvider open={setModal}>
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        className={`hidden bg-rail transition-[width] duration-150 md:sticky md:top-0 md:flex md:h-screen md:flex-shrink-0 md:flex-col md:overflow-x-hidden ${collapsed ? "md:w-[76px]" : "md:w-[260px]"}`}
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
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-rail">
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
          onCreated={(id) => {
            setModal(null);
            router.push(`/taches/${id}`);
          }}
        />
      )}
      {modal === "project" && (
        <CreateProjectModal
          studios={studios}
          clients={clients}
          onClose={() => setModal(null)}
          onCreated={(id) => {
            setModal(null);
            router.push(`/projets/${id}`);
          }}
        />
      )}
      {modal === "request" && <RequestModal studios={studios} onClose={() => setModal(null)} />}
      {modal === "notifications" && (
        <NotificationPrefsModal
          initialNotifyOnAssignment={notifyOnAssignment}
          initialNotifyDailyDigest={notifyDailyDigest}
          initialNotifyOnMention={notifyOnMention}
          initialNotifyOnRequest={notifyOnRequest}
          role={role}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "navOrder" && <NavOrderModal role={role} initialOrder={navOrder} onClose={() => setModal(null)} />}
      {modal === "password" && <ChangePasswordModal onClose={() => setModal(null)} />}
      <CommandPalette navEntries={orderedEntries} />
    </div>
    </CreateModalsProvider>
  );
}
