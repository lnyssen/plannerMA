import { describe, expect, it } from "vitest";
import { entryDurationMinutes, formatDurationFr, sumDurationMinutes } from "../time";

describe("entryDurationMinutes", () => {
  it("calcule la durée entre deux horodatages", () => {
    const entry = { startedAt: new Date("2026-08-31T09:00:00Z"), endedAt: new Date("2026-08-31T10:30:00Z") };
    expect(entryDurationMinutes(entry)).toBe(90);
  });

  it("compte jusqu'à la date de référence quand le minuteur tourne encore", () => {
    const entry = { startedAt: new Date("2026-08-31T09:00:00Z"), endedAt: null };
    expect(entryDurationMinutes(entry, new Date("2026-08-31T09:45:00Z"))).toBe(45);
  });
});

describe("sumDurationMinutes", () => {
  it("additionne plusieurs écritures", () => {
    const entries = [
      { startedAt: new Date("2026-08-31T09:00:00Z"), endedAt: new Date("2026-08-31T10:00:00Z") },
      { startedAt: new Date("2026-08-31T14:00:00Z"), endedAt: new Date("2026-08-31T14:30:00Z") },
    ];
    expect(sumDurationMinutes(entries)).toBe(90);
  });
});

describe("formatDurationFr", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [135, "2 h 15"],
    [125, "2 h 05"],
  ])("formate %i minutes en %s", (minutes, expected) => {
    expect(formatDurationFr(minutes)).toBe(expected);
  });
});
