"use client";

import { Building2, Globe, Mail, Phone, Plus } from "lucide-react";
import { useState } from "react";
import { ClientDetailModal } from "@/components/modals/client-detail-modal";
import { primaryButtonClass } from "@/components/ui/buttons";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { ClientWithCounts } from "@/lib/data/clients";
import { formatDurationFr, sumDurationMinutes } from "@/lib/planning/time";

/** Portefeuille client : temps agrégé tous projets confondus, actifs et archivés — pas seulement le nombre de projets. */
function clientMinutes(client: ClientWithCounts): number {
  const entries = client.projects.flatMap((p) => [...p.timeEntries, ...p.tasks.flatMap((t) => t.timeEntries)]);
  return sumDurationMinutes(entries);
}

export function ClientsView({
  clients,
  initialOpenClientId = null,
  isAdmin,
}: {
  clients: ClientWithCounts[];
  initialOpenClientId?: string | null;
  /** Créer/modifier/supprimer un client est réservé aux administrateurs — voir src/lib/actions/clients.ts. Les autres comptes gardent une consultation en lecture seule. */
  isAdmin: boolean;
}) {
  const [openClientId, setOpenClientId] = useState<string | null | "new">(initialOpenClientId);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Clients
        </h1>
        <span className="flex-1" />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setOpenClientId("new")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${primaryButtonClass}`}
          >
            <Plus size={14} /> Nouveau client
          </button>
        )}
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun client pour l’instant"
          description={
            isAdmin
              ? "Créez votre premier client — vous pourrez ensuite y rattacher des projets."
              : "Aucun client n’a encore été créé."
          }
          actionLabel={isAdmin ? "Nouveau client" : undefined}
          onAction={isAdmin ? () => setOpenClientId("new") : undefined}
        />
      ) : (
        <DataTable
          rows={clients}
          getRowId={(c) => c.id}
          onRowClick={(c) => setOpenClientId(c.id)}
          storageKey="planning-studios:colonnes:clients"
          columns={[
            {
              key: "nom",
              label: "Client",
              required: true,
              sortValue: (c) => c.name,
              render: (c) => <span className="font-semibold text-heading">{c.name}</span>,
            },
            {
              key: "projets",
              label: "Projets",
              sortValue: (c) => c._count.projects,
              cellClassName: "whitespace-nowrap tabular-nums",
              render: (c) => {
                const total = c._count.projects;
                const actifs = c.projects.filter((p) => !p.archived).length;
                return (
                  <>
                    {total}
                    {actifs !== total && <span className="text-ink-muted"> ({actifs} actif{actifs === 1 ? "" : "s"})</span>}
                  </>
                );
              },
            },
            {
              key: "temps",
              label: "Temps enregistré",
              sortValue: (c) => clientMinutes(c),
              cellClassName: "whitespace-nowrap text-ink-muted tabular-nums",
              render: (c) => {
                const m = clientMinutes(c);
                return m > 0 ? formatDurationFr(m) : "—";
              },
            },
            {
              key: "contact",
              label: "Contact",
              sortValue: (c) => c.contactName ?? "",
              render: (c) => c.contactName ?? <span className="text-ink-muted">—</span>,
            },
            {
              key: "email",
              label: "Email",
              sortValue: (c) => c.contactEmail ?? "",
              render: (c) =>
                c.contactEmail ? (
                  <span className="flex items-center gap-1.5">
                    <Mail size={12} aria-hidden="true" className="flex-shrink-0 text-ink-muted" /> {c.contactEmail}
                  </span>
                ) : (
                  <span className="text-ink-muted">—</span>
                ),
            },
            {
              key: "telephone",
              label: "Téléphone",
              sortValue: (c) => c.contactPhone ?? "",
              cellClassName: "whitespace-nowrap",
              render: (c) =>
                c.contactPhone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone size={12} aria-hidden="true" className="flex-shrink-0 text-ink-muted" /> {c.contactPhone}
                  </span>
                ) : (
                  <span className="text-ink-muted">—</span>
                ),
            },
            {
              key: "site",
              label: "Site web",
              sortValue: (c) => c.website ?? "",
              render: (c) =>
                c.website ? (
                  <span className="flex items-center gap-1.5 truncate">
                    <Globe size={12} aria-hidden="true" className="flex-shrink-0 text-ink-muted" /> {c.website}
                  </span>
                ) : (
                  <span className="text-ink-muted">—</span>
                ),
            },
          ]}
        />
      )}

      {openClientId && (
        <ClientDetailModal
          clientId={openClientId === "new" ? null : openClientId}
          onClose={() => setOpenClientId(null)}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
