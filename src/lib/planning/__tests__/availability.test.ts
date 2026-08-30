import { describe, expect, it } from "vitest";
import { belgianHolidays } from "../dates";
import { weeklyLoad } from "../availability";

const holidays = belgianHolidays(2026);
const PERSON = "person-1";

describe("weeklyLoad", () => {
  it("compte 5 jours disponibles sur une semaine ordinaire sans absence ni tâche", () => {
    const load = weeklyLoad(PERSON, new Date("2026-01-05T00:00:00.000Z"), [], [], holidays);
    expect(load.available).toBe(5);
    expect(load.occupied).toBe(0);
    expect(load.ratio).toBe(0);
  });

  it("déduit les jours fériés en semaine de la disponibilité", () => {
    // Semaine du 11 mai 2026 : Ascension tombe le jeudi 14 mai.
    const load = weeklyLoad(PERSON, new Date("2026-05-11T00:00:00.000Z"), [], [], holidays);
    expect(load.available).toBe(4);
  });

  it("déduit les jours d'absence de la disponibilité", () => {
    const absences = [{ personId: PERSON, startDate: "2026-01-05", endDate: "2026-01-06" }];
    const load = weeklyLoad(PERSON, new Date("2026-01-05T00:00:00.000Z"), [], absences, holidays);
    expect(load.available).toBe(3);
  });

  it("ne compte que les tâches non terminées comme occupant un jour", () => {
    const tasks = [
      { personId: PERSON, isDone: false, startDate: "2026-01-05", endDate: "2026-01-07" },
      { personId: PERSON, isDone: true, startDate: "2026-01-08", endDate: "2026-01-09" },
    ];
    const load = weeklyLoad(PERSON, new Date("2026-01-05T00:00:00.000Z"), tasks, [], holidays);
    expect(load.occupied).toBe(3);
    expect(load.ratio).toBe(3 / 5);
  });

  it("compte un jour couvert par plusieurs tâches une seule fois (limite binaire assumée)", () => {
    const tasks = [
      { personId: PERSON, isDone: false, startDate: "2026-01-05", endDate: "2026-01-06" },
      { personId: PERSON, isDone: false, startDate: "2026-01-05", endDate: "2026-01-06" },
      { personId: PERSON, isDone: false, startDate: "2026-01-05", endDate: "2026-01-06" },
    ];
    const load = weeklyLoad(PERSON, new Date("2026-01-05T00:00:00.000Z"), tasks, [], holidays);
    expect(load.occupied).toBe(2);
  });

  it("ignore les tâches et absences d'une autre personne", () => {
    const tasks = [{ personId: "quelqu-un-d-autre", isDone: false, startDate: "2026-01-05", endDate: "2026-01-09" }];
    const load = weeklyLoad(PERSON, new Date("2026-01-05T00:00:00.000Z"), tasks, [], holidays);
    expect(load.occupied).toBe(0);
  });

  it("renvoie un ratio nul plutôt qu'une division par zéro quand rien n'est disponible", () => {
    const absences = [{ personId: PERSON, startDate: "2026-01-05", endDate: "2026-01-09" }];
    const load = weeklyLoad(PERSON, new Date("2026-01-05T00:00:00.000Z"), [], absences, holidays);
    expect(load.available).toBe(0);
    expect(load.ratio).toBe(0);
  });
});
