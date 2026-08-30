"use client";

import type { ClientSummary } from "@/lib/data/clients";
import { FieldLabel, fieldInputClass } from "./modal-shell";

const NEW_CLIENT_VALUE = "__new__";

export function ClientPicker({
  clients,
  clientId,
  newClientName,
  onChange,
}: {
  clients: ClientSummary[];
  clientId: string | null;
  newClientName: string | null;
  onChange: (patch: { clientId: string | null; newClientName: string | null }) => void;
}) {
  const creatingNew = clientId === null;

  return (
    <>
      <FieldLabel htmlFor="client-select">Client</FieldLabel>
      <select
        id="client-select"
        className={`${fieldInputClass} mb-3`}
        value={creatingNew ? NEW_CLIENT_VALUE : (clientId ?? "")}
        onChange={(e) => {
          if (e.target.value === NEW_CLIENT_VALUE) onChange({ clientId: null, newClientName: newClientName ?? "" });
          else onChange({ clientId: e.target.value, newClientName: null });
        }}
      >
        {clients.length === 0 && <option value="">—</option>}
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_CLIENT_VALUE}>+ Nouveau client…</option>
      </select>

      {creatingNew && (
        <input
          type="text"
          className={`${fieldInputClass} mb-3`}
          value={newClientName ?? ""}
          onChange={(e) => onChange({ clientId: null, newClientName: e.target.value })}
          placeholder="Direction, CSEM, Oxfam…"
          autoFocus
        />
      )}
    </>
  );
}
