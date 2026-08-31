"use client";

import { Pencil, Plus, Umbrella, Users } from "lucide-react";
import { useState } from "react";
import { deleteAbsence } from "@/lib/actions/absences";
import { useRouter } from "next/navigation";
import { AbsenceModal } from "@/components/modals/absence-modal";
import { PersonModal } from "@/components/modals/person-modal";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { StudioBadge } from "@/components/ui/studio-badge";
import type { StudioSummary } from "@/lib/data/studios";
import { formatShortFr, toIsoDate } from "@/lib/planning/dates";

interface PersonRow {
  id: string;
  name: string;
  team: string | null;
  external: boolean;
  studios: { studio: StudioSummary }[];
  activeTaskCount: number;
}

interface AbsenceRow {
  id: string;
  personName: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
}

export function EquipeView({
  people,
  absences,
  studios,
}: {
  people: PersonRow[];
  absences: AbsenceRow[];
  studios: StudioSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"gens" | "absences">("gens");
  const [personModal, setPersonModal] = useState<"new" | string | null>(null);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);

  const teams = [...new Set(people.map((p) => p.team || "Studios"))];
  const peopleForAbsenceForm = people.map((p) => ({ id: p.id, name: p.name, team: p.team, external: p.external }));

  return (
    <div className="px-8 py-8">
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
        </div>
        <span className="flex-1" />
        {tab === "gens" ? (
          <button
            type="button"
            onClick={() => setPersonModal("new")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${primaryButtonClass}`}
          >
            <Plus size={14} /> Ajouter une personne
          </button>
        ) : (
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
          {people.length === 0 && <p className="text-sm text-ink-muted">Personne pour l’instant.</p>}
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
                    >
                      <div className="min-w-[130px]">
                        <span className="font-[family-name:var(--font-body)] text-base font-bold text-rail">{p.name}</span>
                        {p.external && <span className="ml-2 text-2xs font-bold text-alert">Invité</span>}
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
                      <button
                        type="button"
                        onClick={() => setPersonModal(p.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${secondaryButtonClass}`}
                      >
                        <Pencil size={13} /> Modifier
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          {absences.length === 0 && <p className="text-sm text-ink-muted">Aucune absence enregistrée.</p>}
          <div className="flex flex-col gap-2">
            {absences.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3 transition-colors duration-100 hover:border-heading"
              >
                <Umbrella size={16} className="flex-shrink-0 text-heading" aria-hidden="true" />
                <span className="min-w-[130px] font-[family-name:var(--font-body)] text-base font-bold text-rail">
                  {a.personName}
                </span>
                <span className="flex-1 text-sm text-ink">
                  du {formatShortFr(toIsoDate(a.startDate))} au {formatShortFr(toIsoDate(a.endDate))}
                  {a.reason && ` · ${a.reason}`}
                </span>
                <button
                  type="button"
                  onClick={() => deleteAbsence(a.id).then(() => router.refresh())}
                  className={`px-2 py-1 text-sm font-semibold ${dangerButtonClass}`}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {personModal && (
        <PersonModal
          personId={personModal === "new" ? null : personModal}
          studios={studios}
          onClose={() => setPersonModal(null)}
        />
      )}
      {absenceModalOpen && <AbsenceModal people={peopleForAbsenceForm} onClose={() => setAbsenceModalOpen(false)} />}
    </div>
  );
}
