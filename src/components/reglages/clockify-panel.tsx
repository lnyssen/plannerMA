"use client";

import { AlertTriangle, CheckCircle2, Download, Link2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  importClockifyMonth,
  linkClockifyPeople,
  pushClockifyReferential,
  type ClockifyStatus,
} from "@/lib/actions/clockify";
import { fieldInputClass, FieldLabel } from "@/components/modals/modal-shell";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SectionHeading } from "@/components/ui/section-heading";
import { useToast } from "@/components/ui/toast";

function Stat({ label, value, total }: { label: string; value: number; total?: number }) {
  const incomplete = total !== undefined && value < total;
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-2xs font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <p
        className="font-[family-name:var(--font-display)] text-lg font-semibold tabular-nums"
        style={{ color: incomplete ? "var(--color-alert)" : "var(--color-heading)" }}
      >
        {value}
        {total !== undefined && <span className="text-sm text-ink-muted"> / {total}</span>}
      </p>
    </div>
  );
}

/** Mois par défaut de l'import : le précédent, celui qu'on vient clôturer. */
function previousMonth() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Réglages → Clockify.
 *
 * Un seul sens par type de donnée : le référentiel descend (clients et
 * projets du planner vers Clockify, pour que l'équipe pointe sur les bons
 * projets), les heures remontent. Rien ne circule dans les deux sens, donc
 * aucun arbitrage de conflit à écrire ni à expliquer.
 */
export function ClockifyPanel({ status }: { status: ClockifyStatus }) {
  const router = useRouter();
  const toast = useToast();
  const ask = useConfirm();
  const [pending, startTransition] = useTransition();
  const [month, setMonth] = useState(previousMonth());
  const [report, setReport] = useState<string[] | null>(null);

  if (!status.configured) {
    return (
      <div>
        <SectionHeading>Clockify</SectionHeading>
        <p className="rounded-lg border border-line px-3 py-2.5 text-sm text-ink-muted">
          L’intégration n’est pas configurée. Renseignez <code>CLOCKIFY_API_KEY</code> et{" "}
          <code>CLOCKIFY_WORKSPACE_ID</code> côté serveur (voir <code>.env.example</code>), puis rechargez cette page.
          La clé donne accès à tout l’espace de travail : elle reste dans l’environnement du serveur, jamais dans
          l’application ni en base.
        </p>
      </div>
    );
  }

  function link() {
    startTransition(async () => {
      const result = await linkClockifyPeople();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setReport([
        `${result.linked} personne(s) reliée(s) à leur compte Clockify.`,
        ...(result.unmatched?.length
          ? [`Sans correspondance (adresse courriel absente ou différente) : ${result.unmatched.join(", ")}.`]
          : []),
      ]);
      toast("Correspondances mises à jour.");
      router.refresh();
    });
  }

  async function push() {
    const ok = await ask({
      title: "Envoyer le référentiel vers Clockify ?",
      body: "Les clients et projets actifs y sont créés s’ils manquent, ou renommés s’ils existent déjà. Rien n’est supprimé dans Clockify.",
      confirmLabel: "Envoyer",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await pushClockifyReferential();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setReport([
        `${result.clientsCreated} client(s) créé(s), ${result.projectsCreated} projet(s) créé(s), ${result.projectsUpdated} projet(s) mis à jour.`,
      ]);
      toast("Référentiel envoyé.");
      router.refresh();
    });
  }

  function importMonth() {
    startTransition(async () => {
      const result = await importClockifyMonth({ month });
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setReport([
        `${result.imported ?? 0} écriture(s) importée(s) pour ${month}.`,
        ...(result.skipped ?? []).map((s) => `Écartées — ${s.reason} : ${s.count}.`),
        ...(result.peopleWithoutAccount?.length
          ? [`Sans compte Clockify relié : ${result.peopleWithoutAccount.join(", ")}.`]
          : []),
      ]);
      toast(`${result.imported ?? 0} écriture(s) importée(s).`);
      router.refresh();
    });
  }

  return (
    <div>
      <SectionHeading>Clockify</SectionHeading>

      {status.reachable ? (
        <p className="mb-3 flex items-center gap-2 text-sm text-ink">
          <CheckCircle2 size={15} style={{ color: "var(--color-heading)" }} aria-hidden="true" />
          Connecté — {status.workspaceUsers} compte(s) dans l’espace de travail.
        </p>
      ) : (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-alert bg-alert-wash px-3 py-2 text-sm text-ink">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-alert)" }} aria-hidden="true" />
          {status.error}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Personnes reliées" value={status.linkedPeople} total={status.people} />
        <Stat label="Projets reliés" value={status.linkedProjects} total={status.projects} />
        <Stat label="Écritures importées" value={status.importedEntries} />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <button
          type="button"
          disabled={pending || !status.reachable}
          onClick={link}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
        >
          <Link2 size={14} /> Relier les personnes
        </button>
        <button
          type="button"
          disabled={pending || !status.reachable}
          onClick={push}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${secondaryButtonClass}`}
        >
          <Upload size={14} /> Envoyer le référentiel
        </button>
        <div>
          <FieldLabel htmlFor="clockify-month">Mois à importer</FieldLabel>
          <input
            id="clockify-month"
            type="month"
            className={`${fieldInputClass} max-w-[170px]`}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={pending || !status.reachable}
          onClick={importMonth}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${primaryButtonClass}`}
        >
          <Download size={14} /> Importer les heures
        </button>
      </div>

      {report && (
        <ul className="mb-3 flex list-disc flex-col gap-1 rounded-lg border border-line px-6 py-3 text-sm text-ink marker:text-ink-muted">
          {report.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <p className="text-2xs text-ink-muted">
        Le référentiel descend (clients et projets du planner vers Clockify), les heures remontent — un seul sens par
        type de donnée, donc aucun conflit possible. Une écriture posée sur un projet Clockify sans correspondance ici
        est écartée et signalée plutôt que rattachée au hasard. Un mois dont la feuille de temps est déjà remise ou
        validée n’est pas réimporté : le verrou ne prouverait plus rien.
      </p>
    </div>
  );
}
