"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAbsence } from "@/lib/actions/absences";
import { today } from "@/lib/planning/dates";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/buttons";
import { FieldLabel, fieldInputClass, ModalShell } from "./modal-shell";

export function AbsenceModal({
  people,
  onClose,
}: {
  people: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const auj = today();
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [startDate, setStartDate] = useState(auj);
  const [endDate, setEndDate] = useState(auj);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createAbsence({ personId, startDate, endDate, reason });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <ModalShell title="Déclarer une absence" onClose={onClose}>
      <FieldLabel htmlFor="absence-person">Qui</FieldLabel>
      <select
        id="absence-person"
        className={`${fieldInputClass} mb-3`}
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="mb-3 flex gap-3">
        <div className="flex-1">
          <FieldLabel htmlFor="absence-start">Du</FieldLabel>
          <input
            id="absence-start"
            type="date"
            className={fieldInputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <FieldLabel htmlFor="absence-end">Au</FieldLabel>
          <input
            id="absence-end"
            type="date"
            className={fieldInputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <FieldLabel htmlFor="absence-reason">Motif (facultatif)</FieldLabel>
      <input
        id="absence-reason"
        className={`${fieldInputClass} mb-4`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Congé, formation, mission extérieure…"
      />

      {error && (
        <p role="alert" className="mb-3 text-xs font-semibold text-alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className={`px-4 py-2 text-sm font-semibold ${secondaryButtonClass}`}
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending || !personId}
          onClick={submit}
          className={`px-4 py-2 text-sm font-semibold ${primaryButtonClass}`}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </ModalShell>
  );
}
