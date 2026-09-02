"use client";

import { CheckCircle2, Lock, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reviewTimesheet, submitTimesheet, type MyTimesheet, type PendingTimesheet } from "@/lib/actions/timesheets";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SectionHeading } from "@/components/ui/section-heading";
import { useToast } from "@/components/ui/toast";
import { formatDurationFr } from "@/lib/planning/time";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  return `${MOIS[Number(month) - 1]} ${year}`;
}

const STATUS_LABEL = {
  DRAFT: "En cours",
  SUBMITTED: "Remise, en attente",
  APPROVED: "Validée",
} as const;

function StatusPill({ status }: { status: MyTimesheet["status"] }) {
  const approved = status === "APPROVED";
  const submitted = status === "SUBMITTED";
  return (
    <span
      className="flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold whitespace-nowrap"
      style={{
        background: approved
          ? "color-mix(in srgb, var(--color-heading) 12%, transparent)"
          : submitted
            ? "var(--color-line)"
            : "var(--color-wash)",
        color: approved ? "var(--color-heading)" : "var(--color-ink-muted)",
      }}
    >
      {approved && <Lock size={10} aria-hidden="true" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Feuilles de temps mensuelles : remise par la personne, validation par un
 * administrateur.
 *
 * Rien ne verrouillait les écritures : un mois « clôturé » restait modifiable
 * indéfiniment, ce qui empêchait de prouver au moment d'un contrôle que les
 * chiffres remis n'avaient pas bougé depuis. Le verrou porte sur le mois
 * entier — voir timesheetLockFor, appliqué à toutes les écritures.
 */
export function TimesheetPanel({
  mine,
  pending,
  isAdmin,
}: {
  mine: MyTimesheet[];
  pending: PendingTimesheet[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const ask = useConfirm();
  const [pendingTransition, startTransition] = useTransition();

  function submit(month: string) {
    startTransition(async () => {
      const result = await submitTimesheet(month);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(`Feuille de ${monthLabel(month)} remise.`);
      router.refresh();
    });
  }

  async function review(row: PendingTimesheet, decision: "approve" | "reopen") {
    const ok = await ask({
      title:
        decision === "approve"
          ? `Valider la feuille de ${row.personName} pour ${monthLabel(row.month)} ?`
          : `Rouvrir la feuille de ${row.personName} pour ${monthLabel(row.month)} ?`,
      body:
        decision === "approve"
          ? "Les écritures de ce mois seront verrouillées : plus personne ne pourra les modifier sans réouverture."
          : "La personne pourra de nouveau modifier ses écritures, puis remettre la feuille.",
      confirmLabel: decision === "approve" ? "Valider" : "Rouvrir",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await reviewTimesheet({ periodId: row.id, decision });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      toast(decision === "approve" ? "Feuille validée." : "Feuille rouverte.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHeading>Vos feuilles de temps</SectionHeading>
        <div className="flex flex-col gap-1.5">
          {mine.map((m) => (
            <div
              key={m.month}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm"
            >
              <span className="min-w-[9rem] font-semibold text-heading">{monthLabel(m.month)}</span>
              <span className="text-ink-muted tabular-nums">{formatDurationFr(m.minutes)}</span>
              <StatusPill status={m.status} />
              {m.note && <span className="w-full text-2xs text-alert">Motif de réouverture : {m.note}</span>}
              <span className="flex-1" />
              {m.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={pendingTransition}
                  onClick={() => submit(m.month)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${secondaryButtonClass}`}
                >
                  <Send size={13} /> Remettre
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-ink-muted">
          Une feuille remise ne peut plus être modifiée : demandez sa réouverture à un administrateur. Un mois en cours
          ne se remet qu’une fois terminé.
        </p>
      </div>

      {isAdmin && (
        <div>
          <SectionHeading count={pending.length}>Feuilles remises et validées</SectionHeading>
          {pending.length === 0 ? (
            <p className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink-muted">
              Aucune feuille remise pour l’instant.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {pending.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm"
                >
                  <span className="font-semibold text-heading">{row.personName}</span>
                  <span className="text-ink">{monthLabel(row.month)}</span>
                  <span className="text-ink-muted tabular-nums">{formatDurationFr(row.minutes)}</span>
                  <StatusPill status={row.status} />
                  <span className="flex-1" />
                  {/* Rouvrir reste possible sur une feuille déjà validée :
                      une correction en base ou un mois validé trop tôt doit
                      pouvoir être repris. */}
                  <button
                    type="button"
                    disabled={pendingTransition}
                    onClick={() => review(row, "reopen")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${secondaryButtonClass}`}
                  >
                    <RotateCcw size={13} /> Rouvrir
                  </button>
                  {row.status === "SUBMITTED" && (
                    <button
                      type="button"
                      disabled={pendingTransition}
                      onClick={() => review(row, "approve")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${primaryButtonClass}`}
                    >
                      <CheckCircle2 size={13} /> Valider
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
