"use client";

import { Globe, Mail, Phone, Plus } from "lucide-react";
import { useState } from "react";
import { ClientDetailModal } from "@/components/modals/client-detail-modal";
import { primaryButtonClass } from "@/components/ui/buttons";
import type { ClientWithCounts } from "@/lib/data/clients";

function ClientCard({ client, onOpen }: { client: ClientWithCounts; onOpen: (id: string) => void }) {
  const count = client._count.projects;
  const hasContact = client.contactName || client.contactEmail || client.contactPhone || client.website;

  return (
    <button
      type="button"
      onClick={() => onOpen(client.id)}
      className="rounded-lg border border-line p-4 text-left transition-colors duration-100 hover:border-heading active:bg-wash"
      title="Modifier le client"
    >
      <div className="mb-1 font-[family-name:var(--font-body)] text-base font-bold text-rail">{client.name}</div>
      <div className="mb-3 text-sm font-semibold text-ink">
        {count} projet{count === 1 ? "" : "s"}
      </div>

      {hasContact ? (
        <div className="flex flex-col gap-1 text-sm text-ink-muted">
          {client.contactName && <div>{client.contactName}</div>}
          {client.contactEmail && (
            <div className="flex items-center gap-1.5">
              <Mail size={12} aria-hidden="true" /> {client.contactEmail}
            </div>
          )}
          {client.contactPhone && (
            <div className="flex items-center gap-1.5">
              <Phone size={12} aria-hidden="true" /> {client.contactPhone}
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-1.5">
              <Globe size={12} aria-hidden="true" /> {client.website}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Aucune coordonnée enregistrée.</p>
      )}
    </button>
  );
}

export function ClientsView({
  clients,
  initialOpenClientId = null,
}: {
  clients: ClientWithCounts[];
  initialOpenClientId?: string | null;
}) {
  const [openClientId, setOpenClientId] = useState<string | null | "new">(initialOpenClientId);

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.1px] text-heading">
          Clients
        </h1>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setOpenClientId("new")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${primaryButtonClass}`}
        >
          <Plus size={14} /> Nouveau client
        </button>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-ink-muted">Aucun client. Utilisez « Nouveau client » pour commencer.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {clients.map((c) => (
            <ClientCard key={c.id} client={c} onOpen={setOpenClientId} />
          ))}
        </div>
      )}

      {openClientId && (
        <ClientDetailModal
          clientId={openClientId === "new" ? null : openClientId}
          onClose={() => setOpenClientId(null)}
        />
      )}
    </div>
  );
}
