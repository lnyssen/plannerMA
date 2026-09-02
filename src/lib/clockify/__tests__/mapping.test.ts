import { describe, expect, it } from "vitest";
import { clockifyProjectName, decideImport, monthKeyOfIso, monthRange } from "../mapping";

describe("clockifyProjectName", () => {
  it("préfixe le code quand il existe", () => {
    expect(clockifyProjectName({ name: "Refonte du site", code: "SITE-1" })).toBe("[SITE-1] Refonte du site");
  });

  it("se contente du nom sans code", () => {
    expect(clockifyProjectName({ name: "Refonte du site", code: null })).toBe("Refonte du site");
  });
});

describe("monthRange", () => {
  it("borne le mois du premier jour au premier du mois suivant", () => {
    expect(monthRange("2026-09")).toEqual({ start: "2026-09-01T00:00:00Z", end: "2026-10-01T00:00:00Z" });
  });

  it("passe correctement une fin d’année", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01T00:00:00Z", end: "2027-01-01T00:00:00Z" });
  });
});

describe("decideImport", () => {
  const known = {
    alreadyImported: new Set(["deja-la"]),
    projectByClockifyId: new Map([["cl-projet", "planner-projet"]]),
  };
  const base = {
    id: "neuve",
    description: "Montage",
    projectId: "cl-projet",
    timeInterval: { start: "2026-09-01T08:00:00Z", end: "2026-09-01T10:00:00Z" },
  };

  it("retient une écriture terminée, inconnue, sur un projet relié", () => {
    expect(decideImport(base, known)).toEqual({ keep: true });
  });

  it("écarte un minuteur encore en cours", () => {
    const running = { ...base, timeInterval: { start: base.timeInterval.start, end: null } };
    expect(decideImport(running, known)).toEqual({ keep: false, reason: "minuteur encore en cours" });
  });

  it("écarte une écriture déjà importée — réimporter ne double pas les heures", () => {
    expect(decideImport({ ...base, id: "deja-la" }, known)).toEqual({ keep: false, reason: "déjà importée" });
  });

  it("écarte une écriture sur un projet sans correspondance plutôt que de la rattacher au hasard", () => {
    expect(decideImport({ ...base, projectId: "inconnu" }, known).keep).toBe(false);
    expect(decideImport({ ...base, projectId: null }, known).keep).toBe(false);
  });
});

describe("monthKeyOfIso", () => {
  it("rattache l’écriture au mois de son début, en UTC", () => {
    expect(monthKeyOfIso("2026-09-30T23:30:00Z")).toBe("2026-09");
    expect(monthKeyOfIso("2026-10-01T00:30:00Z")).toBe("2026-10");
  });
});
