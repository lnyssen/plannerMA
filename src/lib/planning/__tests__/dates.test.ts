import { describe, expect, it } from "vitest";
import { addMonthsIso, addMonthsSameWeekdayIso, belgianHolidays, easterSunday, formatRangeFr, isBusinessDay, mondayOf, toIsoDate } from "../dates";

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

describe("addMonthsIso", () => {
  it("avance d'un mois en gardant le même jour", () => {
    expect(addMonthsIso("2026-03-15", 1)).toBe("2026-04-15");
  });

  it("cale sur le dernier jour du mois cible quand le jour d'origine n'existe pas", () => {
    // 31 janvier + 1 mois : février 2026 n'a que 28 jours
    expect(addMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("gère un changement d'année", () => {
    expect(addMonthsIso("2026-12-05", 1)).toBe("2027-01-05");
  });

  it("gère un intervalle de plusieurs mois", () => {
    expect(addMonthsIso("2026-01-31", 3)).toBe("2026-04-30");
  });
});

describe("formatRangeFr", () => {
  it("reste compact pour une plage dans le même mois", () => {
    expect(formatRangeFr("2026-08-17", "2026-08-30")).toBe("Du 17 au 30 août 2026");
  });

  it("répète le mois de fin quand la plage change de mois", () => {
    expect(formatRangeFr("2026-08-28", "2026-09-10")).toBe("Du 28 août au 10 septembre 2026");
  });

  it("précise les deux années quand la plage chevauche le nouvel an", () => {
    expect(formatRangeFr("2026-12-28", "2027-01-10")).toBe("Du 28 décembre 2026 au 10 janvier 2027");
  });
});

describe("addMonthsSameWeekdayIso", () => {
  it("garde le rang du jour de semaine plutôt que le quantième", () => {
    // 2026-09-07 est le premier lundi de septembre ; le premier lundi
    // d'octobre 2026 est le 5, pas le 7.
    expect(addMonthsSameWeekdayIso("2026-09-07", 1)).toBe("2026-10-05");
  });

  it("gère un troisième jeudi", () => {
    // 2026-01-15 est le troisième jeudi de janvier ; celui de février est le 19.
    expect(addMonthsSameWeekdayIso("2026-01-15", 1)).toBe("2026-02-19");
  });

  it("retombe sur le dernier du mois quand le rang n’existe pas", () => {
    // 2026-01-29 est le cinquième jeudi de janvier ; février 2026 n'en a que
    // quatre, on retient le dernier (26).
    expect(addMonthsSameWeekdayIso("2026-01-29", 1)).toBe("2026-02-26");
  });

  it("recule aussi bien qu’il avance", () => {
    expect(addMonthsSameWeekdayIso("2026-10-05", -1)).toBe("2026-09-07");
  });
});
