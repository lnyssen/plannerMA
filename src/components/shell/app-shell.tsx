"use client";

import type { Role } from "@prisma/client";
import type { ThemePreference } from "@prisma/client";
import {
  AlertTriangle,
  ArrowUpDown,
  Bell,
  ChevronDown,
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
import { iconButtonOnRailClass, primaryOnRailButtonClass, secondaryOnRailButtonClass } from "@/components/ui/buttons";
import type { ClientSummary } from "@/lib/data/clients";
import type { PersonSummary } from "@/lib/data/people";
import type { ProjectOption } from "@/lib/data/projects";
import type { StudioSummary } from "@/lib/data/studios";
import type { TaskOption } from "@/lib/data/tasks";
import { signOutAction } from "./actions";
import { CommandPalette } from "./command-palette";
import { CreateModalsProvider, type CreateModalKind, type CreateModalPrefill } from "./create-modals-context";
import { GlobalSearch } from "./global-search";
import { applyNavOrder, NAV_COUNT_META, NAV_ENTRIES, type NavCounts } from "./nav-entries";
import { NotificationBell } from "./notification-bell";

// Teintes propres au rail (aplat violet plein). Le système de tokens décrit
// les couleurs du contenu sur fond papier, pas celles posées sur le rail :
// on les nomme ici une fois plutôt que de recopier des littéraux au fil du
// fichier.
const ON_RAIL = {
  /** Libellé d'une entrée au repos. */
  text: "rgba(255,255,255,0.86)",
  /** Texte plein contraste (puces, page courante inversée). */
  textStrong: "#FFFFFF",
  /** Aplat neutre d'une puce de comptage. */
  fill: "rgba(255,255,255,0.22)",
} as const;

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  STUDIO_LEAD: "Responsable de studio",
  COLLABORATOR: "Collaborateur",
};

// Préférence purement locale (repliée ou non) : pas de sens à la
// synchroniser entre appareils, contrairement à navOrder (compte) — même
// registre que la bascule Cartes/Tableau de Projets.
const COLLAPSE_STORAGE_KEY = "planning-studios:nav-collapsed";
// Quels groupes de menu sont repliés — distinct de COLLAPSE_STORAGE_KEY (qui
// réduit tout le menu aux icônes) : ici chaque groupe (Travail, Projets…)
// se replie indépendamment, liste de noms de groupe en JSON.
const GROUP_COLLAPSE_STORAGE_KEY = "planning-studios:nav-groups-collapsed";

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
  notifyOnComment: boolean;
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
  notifyOnComment,
  navOrder,
  theme,
  counts,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modal, setModal] = useState<"task" | "project" | "request" | "notifications" | "navOrder" | "password" | null>(null);
  // Valeurs déjà connues par le geste qui ouvre la modale (plage de jours
  // tirée dans Semaine ou Gantt) — voir CreateModalsProvider.
  const [taskPrefill, setTaskPrefill] = useState<CreateModalPrefill | undefined>(undefined);

  function openCreateModal(kind: CreateModalKind, prefill?: CreateModalPrefill) {
    setTaskPrefill(prefill);
    setModal(kind);
  }

  function closeModal() {
    setModal(null);
    setTaskPrefill(undefined);
  }
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

  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GROUP_COLLAPSE_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const names = parsed.filter((g): g is string => typeof g === "string");
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCollapsedGroups(names);
        }
      }
    } catch {
      // localStorage indisponible ou JSON invalide — tous les groupes restent dépliés.
    }
  }, []);

  function toggleGroup(group: string) {
    setCollapsedGroups((prev) => {
      const next = prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group];
      try {
        localStorage.setItem(GROUP_COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Rien à faire : la préférence ne survivra juste pas à cette session.
      }
      return next;
    });
  }

  const orderedEntries = applyNavOrder(
    NAV_ENTRIES.filter((e) => !e.adminOnly || role === "ADMIN"),
    navOrder,
  );

  /** Puce rouge « X en problème » — même forme sur une entrée et sur l'intitulé d'un groupe replié. */
  function alertBadge(n: number) {
    return (
      <span
        className="flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums"
        style={{ background: "var(--color-alert)", color: ON_RAIL.textStrong }}
      >
        <AlertTriangle size={10} aria-hidden="true" />
        {n}
      </span>
    );
  }

  function renderNavEntry({ href, label, icon: Icon, countKey }: (typeof orderedEntries)[number], isCollapsed: boolean) {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    const badges = countKey ? NAV_COUNT_META[countKey](counts) : null;
    const total = badges?.total ?? 0;
    const alert = badges?.alert ?? 0;
    // Toujours une infobulle qui explique les nombres (pas seulement replié) :
    // une puce nue à côté d'un libellé ne se comprend pas d'elle-même —
    // "1" à côté de "Tâches" pourrait vouloir dire n'importe quoi sans ce texte.
    const described =
      badges && total > 0
        ? `${label} — ${badges.totalLabel}${alert > 0 ? `, dont ${badges.alertLabel}` : ""}`
        : null;
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setDrawerOpen(false)}
        aria-current={active ? "page" : undefined}
        title={described ?? (isCollapsed ? label : undefined)}
        className={`relative flex items-center gap-2.5 rounded-full font-[family-name:var(--font-body)] text-sm leading-5 transition-colors duration-100 ${
          isCollapsed ? "mx-auto h-9 w-9 justify-center" : "px-3 py-1.5"
        } ${active ? "" : "hover:bg-white/12 active:bg-white/20"}`}
        style={{
          // Pastille pleine pour la page courante : contraste maximal, et
          // même vocabulaire de forme que le reste de l'appli (tout est en
          // pilule) — l'ancien rectangle blanc à 18 % se distinguait mal.
          background: active ? ON_RAIL.textStrong : "transparent",
          color: active ? "var(--color-rail)" : ON_RAIL.text,
          fontWeight: active ? 700 : 600,
        }}
      >
        <Icon size={17} aria-hidden="true" className="flex-shrink-0" />
        {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
        {!isCollapsed && (total > 0 || alert > 0) && (
          <span className="flex flex-shrink-0 items-center gap-1">
            {total > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums"
                style={
                  active
                    ? { background: "color-mix(in srgb, var(--color-rail) 14%, transparent)", color: "var(--color-rail)" }
                    : { background: ON_RAIL.fill, color: ON_RAIL.textStrong }
                }
              >
                {total}
              </span>
            )}
            {alert > 0 && alertBadge(alert)}
          </span>
        )}
        {/* Replié aux icônes il n'y a plus de place pour les puces : seul le
            problème est signalé, par une pastille sur l'icône. */}
        {isCollapsed && alert > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full"
            style={{ background: "var(--color-alert)", boxShadow: "0 0 0 2px var(--color-rail)" }}
          />
        )}
      </Link>
    );
  }

  function renderNav(isCollapsed: boolean) {
    // Les groupes repliables n'ont de sens que pour l'ordre par défaut : dès
    // qu'un ordre personnalisé existe, les entrées peuvent mélanger les
    // groupes (voir applyNavOrder), un regroupement y serait trompeur — et
    // replié à l'icône, il n'y a de toute façon plus de place pour un
    // intitulé de groupe : liste plate dans les deux cas.
    const showGroups = !navOrder || navOrder.length === 0;
    if (!showGroups || isCollapsed) {
      return (
        <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 border-b border-white/15 px-3 pb-3">
          {orderedEntries.map((entry) => renderNavEntry(entry, isCollapsed))}
        </nav>
      );
    }

    const groups: { name: string; entries: typeof orderedEntries }[] = [];
    for (const entry of orderedEntries) {
      const current = groups[groups.length - 1];
      if (current && current.name === entry.group) current.entries.push(entry);
      else groups.push({ name: entry.group, entries: [entry] });
    }

    return (
      <nav aria-label="Navigation principale" className="flex flex-col gap-0.5 border-b border-white/15 px-3 pb-3">
        {groups.map((g, i) => {
          const collapsed = collapsedGroups.includes(g.name);
          // Replier un groupe ne doit jamais faire disparaître un problème :
          // les alertes de ses entrées remontent sur l'intitulé.
          const groupAlert = g.entries.reduce(
            (sum, e) => sum + (e.countKey ? NAV_COUNT_META[e.countKey](counts).alert : 0),
            0,
          );
          return (
            <div key={g.name}>
              <button
                type="button"
                onClick={() => toggleGroup(g.name)}
                aria-expanded={!collapsed}
                title={collapsed && groupAlert > 0 ? `${g.name} — ${groupAlert} élément(s) à traiter` : undefined}
                className={`flex w-full items-center gap-1.5 rounded-full px-3 text-2xs font-bold tracking-wide text-white/55 uppercase transition-colors duration-100 hover:text-white ${i === 0 ? "pb-1" : "pt-2.5 pb-1"}`}
              >
                {/* Chevron à gauche : il annonce l'imbrication du groupe, il
                    se lit avant l'intitulé et non après. */}
                <ChevronDown
                  size={12}
                  aria-hidden="true"
                  className={`flex-shrink-0 transition-transform duration-150 ${collapsed ? "-rotate-90" : ""}`}
                />
                <span className="flex-1 text-left">{g.name}</span>
                {collapsed && groupAlert > 0 && alertBadge(groupAlert)}
              </button>
              {!collapsed && <div className="flex flex-col gap-0.5">{g.entries.map((entry) => renderNavEntry(entry, false))}</div>}
            </div>
          );
        })}
      </nav>
    );
  }

  function renderRail(isCollapsed: boolean, showCollapseToggle: boolean) {
    return (
      <>
        <div className={`flex flex-shrink-0 items-start gap-2 px-5 pt-5 pb-4 ${isCollapsed ? "flex-col items-center" : "justify-between"}`}>
          {!isCollapsed && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo bitmap fourni tel quel, pas d'optimisation next/image nécessaire pour cette taille */}
              <img src="/logo/media-animation-blanc.png" alt="Média Animation" className="h-8 w-auto" />
              <div className="mt-1.5 text-sm text-white/70">Studio planner</div>
            </div>
          )}
          <div className={`flex items-center gap-1 ${isCollapsed ? "flex-col" : ""}`}>
            {isCollapsed && <GlobalSearch />}
            <NotificationBell />
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

        {/* Aligné sur les pastilles de navigation (même px-3) plutôt que sur
            le logo, pour que le champ et les entrées partagent un seul bord
            gauche. */}
        {!isCollapsed && (
          <div className="flex-shrink-0 px-3 pb-3">
            <GlobalSearch variant="field" />
          </div>
        )}

        {/* Seule cette zone défile : les boutons d'action et le menu profil
            en dessous restent toujours visibles, même si la liste de
            navigation dépasse la hauteur de l'écran. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{renderNav(isCollapsed)}</div>

        {/* Une seule action mise en avant (créer une tâche, le geste courant)
            et les deux autres réunies sur une ligne : la pile de trois
            boutons pleine largeur donnait le même poids visuel à trois
            gestes de fréquence très différente, et mangeait la hauteur utile
            du menu. */}
        <div className={`flex flex-shrink-0 flex-col gap-2 px-3 pt-4 pb-4 ${isCollapsed ? "items-center" : ""}`}>
          <button
            type="button"
            onClick={() => {
              setModal("task");
              setDrawerOpen(false);
            }}
            title="Nouvelle tâche"
            className={`flex items-center justify-center gap-1.5 text-sm font-bold ${primaryOnRailButtonClass} ${isCollapsed ? "w-10 px-0" : "w-full"}`}
          >
            <ListPlus size={17} /> {!isCollapsed && "Nouvelle tâche"}
          </button>
          <div className={isCollapsed ? "flex flex-col gap-2" : "grid grid-cols-2 gap-2"}>
            <button
              type="button"
              onClick={() => {
                setModal("project");
                setDrawerOpen(false);
              }}
              title="Nouveau projet"
              className={`flex items-center justify-center gap-1.5 text-xs font-bold ${secondaryOnRailButtonClass} ${isCollapsed ? "w-10 px-0" : ""}`}
            >
              <FolderPlus size={15} /> {!isCollapsed && "Projet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setModal("request");
                setDrawerOpen(false);
              }}
              title="Nouvelle demande"
              className={`flex items-center justify-center gap-1.5 text-xs font-bold ${secondaryOnRailButtonClass} ${isCollapsed ? "w-10 px-0" : ""}`}
            >
              <ClipboardPlus size={15} /> {!isCollapsed && "Demande"}
            </button>
          </div>
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
    <CreateModalsProvider open={openCreateModal}>
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        className={`hidden bg-rail transition-[width] duration-150 md:sticky md:top-0 md:flex md:h-screen md:flex-shrink-0 md:flex-col md:overflow-x-hidden ${collapsed ? "md:w-[76px]" : "md:w-[260px]"}`}
      >
        {renderRail(collapsed, true)}
      </aside>

      <header className="relative flex h-14 items-center justify-between bg-rail px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className={iconButtonOnRailClass}
        >
          <Menu size={24} />
        </button>
        {/* Centré sur toute la largeur de l'en-tête (pas juste entre les deux
            groupes d'icônes, de largeurs inégales) : position absolue plutôt
            que justify-between, qui centrerait par rapport aux bords, pas au
            vrai milieu, dès que les deux groupes n'ont pas le même poids. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- logo bitmap fourni tel quel */}
        <img
          src="/logo/media-animation-blanc.png"
          alt="Média Animation"
          className="absolute left-1/2 h-6 w-auto -translate-x-1/2"
        />
        <div className="flex items-center gap-1">
          <GlobalSearch />
          <NotificationBell />
          <button
            type="button"
            onClick={() => setModal("task")}
            aria-label="Nouvelle tâche"
            className={`flex w-10 items-center justify-center ${primaryOnRailButtonClass}`}
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
          initialValues={taskPrefill}
          onClose={closeModal}
          onCreated={(id) => {
            closeModal();
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
          initialNotifyOnComment={notifyOnComment}
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
