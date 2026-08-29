import { describe, expect, it } from "vitest";
import { belgianHolidays, easterSunday, isBusinessDay, mondayOf, toIsoDate } from "../dates";

describe("easterSunday", () => {
  // Dates de référence publiques du dimanche de Pâques (calendrier grégorien).
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
  ])("Pâques %i tombe le %s", (year, expected) => {
    expect(toIsoDate(easterSunday(year))).toBe(expected);
  });
});

describe("belgianHolidays", () => {
  it("place les dix fériés légaux 2026 aux bonnes dates", () => {
    const holidays = belgianHolidays(2026);
    expect(holidays["2026-01-01"]).toBe("Nouvel An");
    expect(holidays["2026-04-06"]).toBe("Lundi de Pâques"); // Pâques 2026 + 1
    expect(holidays["2026-05-01"]).toBe("Fête du travail");
    expect(holidays["2026-05-14"]).toBe("Ascension"); // Pâques 2026 + 39
    expect(holidays["2026-05-25"]).toBe("Lundi de Pentecôte"); // Pâques 2026 + 50
    expect(holidays["2026-07-21"]).toBe("Fête nationale");
    expect(holidays["2026-08-15"]).toBe("Assomption");
    expect(holidays["2026-11-01"]).toBe("Toussaint");
    expect(holidays["2026-11-11"]).toBe("Armistice");
    expect(holidays["2026-12-25"]).toBe("Noël");
    expect(Object.keys(holidays)).toHaveLength(10);
  });
});

describe("isBusinessDay", () => {
  const holidays = belgianHolidays(2026);

  it("exclut les week-ends", () => {
    // 2026-01-03 est un samedi
    expect(isBusinessDay(new Date("2026-01-03T00:00:00.000Z"), holidays)).toBe(false);
    expect(isBusinessDay(new Date("2026-01-04T00:00:00.000Z"), holidays)).toBe(false);
  });

  it("exclut les jours fériés en semaine", () => {
    // Noël 2026 tombe un vendredi
    expect(isBusinessDay(new Date("2026-12-25T00:00:00.000Z"), holidays)).toBe(false);
  });

  it("accepte un jour ouvrable normal", () => {
    expect(isBusinessDay(new Date("2026-01-06T00:00:00.000Z"), holidays)).toBe(true);
  });
});

describe("mondayOf", () => {
  it("ramène n'importe quel jour de la semaine au lundi", () => {
    // 2026-08-29 est un samedi
    expect(toIsoDate(mondayOf(new Date("2026-08-29T00:00:00.000Z")))).toBe("2026-08-24");
    // Le lundi lui-même reste inchangé
    expect(toIsoDate(mondayOf(new Date("2026-08-24T00:00:00.000Z")))).toBe("2026-08-24");
  });
});
