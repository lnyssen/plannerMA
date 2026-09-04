"use client";

import { CalendarDays, Pencil, Plus, RotateCcw, UserMinus, Umbrella, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAbsence } from "@/lib/actions/absences";
import { setPersonActive } from "@/lib/actions/people";
import { useRouter } from "next/navigation";
import { AbsenceCalendar } from "@/components/equipe/absence-calendar";
import { AbsenceModal } from "@/components/modals/absence-modal";
import { PersonModal } from "@/components/modals/person-modal";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass, textButtonClass } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { StudioSummary } from "@/lib/data/studios";
import { formatShortFr, toIsoDate } from "@/lib/planning/dates";

interface PersonRow {
  id: string;
  name: string;
  team: string | null;
  external: boolean;
  active: boolean;
  studios: { studio: StudioSummary }[];
  activeTaskCount: number;
}

interface AbsenceRow {
  id: string;
  personId: string;
  personName: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
}

export function EquipeView({
  people,
  absences,
  studios,
  isAdmin,
  currentPersonId,
}: {
  people: PersonRow[];
  absences: AbsenceRow[];
  studios: StudioSummary[];
  isAdmin: boolean;
  currentPersonId: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"gens" | "absences" | "calendrier">("gens");
  const [personModal, setPersonModal] = useState<"new" | string | null>(null);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);

  const teams = [...new Set(people.map((p) => p.team || "Studios"))];
  // Gérer l'absence de quelqu'un d'autre est réservé aux administrateurs —
  // voir canManageAbsenceFor côté serveur (src/lib/actions/absences.ts), qui
  // applique la même règle et reste la source de vérité.
  const canManage = (p: PersonRow) => isAdmin || p.id === currentPersonId;
  const peopleForAbsenceForm = people.filter(canManage).map((p) => ({ id: p.id, name: p.name }));
  const manageablePersonIds = new Set(peopleForAbsenceForm.map((p) => p.id));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Équipe
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("gens")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${tab === "gens" ? primaryButtonClass : secondaryButtonClass}`}
          >
            <Users size={14} /> Personnes
          </button>
          <button
            type="button"
            onClick={() => setTab("absences")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${tab === "absences" ? primaryButtonClass : secondaryButtonClass}`}
          >
            <Umbrella size={14} /> Absences
          </button>
          <button
            type="button"
            onClick={() => setTab("calendrier")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${tab === "calendrier" ? primaryButtonClass : secondaryButtonClass}`}
          >
            <CalendarDays size={14} /> Calendrier
          </button>
        </div>
        <span className="flex-1" />
        {tab === "gens" && isAdmin && (
          <button
            type="button"
            onClick={() => setPersonModal("new")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${primaryButtonClass}`}
          >
            <Plus size={14} /> Ajouter une personne
          </button>
        )}
        {tab === "absences" && (
          <button
            type="button"
            onClick={() => setAbsenceModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${primaryButtonClass}`}
          >
            <Plus size={14} /> Déclarer une absence
          </button>
        )}
      </div>

      {tab === "gens" ? (
        <>
          {people.length === 0 && (
            <EmptyState
              icon={Users}
              title="Personne dans l’équipe pour l’instant"
              description="Ajoutez la première personne pour commencer à assigner des tâches."
              actionLabel={isAdmin ? "Ajouter une personne" : undefined}
              onAction={isAdmin ? () => setPersonModal("new") : undefined}
            />
          )}
          {teams.map((team) => (
            <div key={team} className="mb-8">
              <h2 className="mb-3 text-xs font-semibold tracking-wide text-ink-muted uppercase">{team}</h2>
              <div className="flex flex-col gap-2">
                {people
                  .filter((p) => (p.team || "Studios") === team)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 transition-colors duration-100 hover:border-heading"
                      style={p.active ? undefined : { opacity: 0.6 }}
                    >
                      <div className="min-w-[130px]">
                        <span className="font-[family-name:var(--font-body)] text-base font-bold text-heading">{p.name}</span>
                        {p.external && <span className="ml-2 text-2xs font-bold text-alert">Invité</span>}
                        {!p.active && <span className="ml-2 text-2xs font-bold text-ink-muted">Inactif</span>}
                      </div>
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {p.studios.length === 0 ? (
                          <span className="text-sm text-ink-muted">Hors studio</span>
                        ) : (
                          p.studios.map(({ studio }) => (
                            <StudioBadge key={studio.id} name={studio.name} fillHex={studio.fillHex} colorHex={studio.colorHex} />
                          ))
                        )}
                      </div>
                      <span className="text-sm tabular-nums text-ink">{p.activeTaskCount} en cours</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            startTransition(async () => {
                              await setPersonActive(p.id, !p.active);
                              router.refresh();
                            })
                          }
                          title={p.active ? "Désactiver — sort des sélecteurs, l’historique reste intact" : "Réactiver"}
                          className={`flex items-center gap-1 text-ink-muted hover:text-alert ${textButtonClass}`}
                        >
                          {p.active ? <UserMinus size={14} /> : <RotateCcw size={14} />}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setPersonModal(p.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
                        >
                          <Pencil size={13} /> Modifier
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </>
      ) : tab === "absences" ? (
        <>
          {absences.length === 0 && (
            <EmptyState
              icon={Umbrella}
              title="Aucune absence enregistrée"
              description="Congé, maladie, formation… déclarez la première absence."
              actionLabel="Déclarer une absence"
              onAction={() => setAbsenceModalOpen(true)}
            />
          )}
          <div className="flex flex-col gap-2">
            {absences.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 transition-colors duration-100 hover:border-heading"
              >
                <Umbrella size={16} className="flex-shrink-0 text-heading" aria-hidden="true" />
                <span className="min-w-[130px] font-[family-name:var(--font-body)] text-base font-bold text-heading">
                  {a.personName}
                </span>
                <span className="flex-1 text-sm text-ink">
                  du {formatShortFr(toIsoDate(a.startDate))} au {formatShortFr(toIsoDate(a.endDate))}
                  {a.reason && ` · ${a.reason}`}
                </span>
                {manageablePersonIds.has(a.personId) && (
                  <button
                    type="button"
                    onClick={() => deleteAbsence(a.id).then(() => router.refresh())}
                    className={`px-2 py-1 text-sm font-semibold ${dangerButtonClass}`}
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "calendrier" && (
        <AbsenceCalendar
          absences={absences.map((a) => ({
            id: a.id,
            personId: a.personId,
            personName: a.personName,
            startDate: a.startDate,
            endDate: a.endDate,
            reason: a.reason,
          }))}
        />
      )}

      {personModal && (
        <PersonModal
          personId={personModal === "new" ? null : personModal}
          studios={studios}
          onClose={() => setPersonModal(null)}
        />
      )}
      {absenceModalOpen && (
        <AbsenceModal
          people={peopleForAbsenceForm}
          currentPersonId={currentPersonId}
          onClose={() => setAbsenceModalOpen(false)}
        />
      )}
    </div>
  );
}
