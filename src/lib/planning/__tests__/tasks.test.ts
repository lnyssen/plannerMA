import { describe, expect, it } from "vitest";
import { hasDependencyConflict, isSubtaskOverdue, taskProgress } from "../tasks";

describe("taskProgress", () => {
  // Quatre statuts par défaut (voir prisma/seed.ts), le dernier "terminé".
  const todo = { position: 0, isDone: false };
  const inProgress = { position: 1, isDone: false };
  const validation = { position: 2, isDone: false };
  const delivered = { position: 3, isDone: true };
  const allStatuses = [todo, inProgress, validation, delivered];

  it("dérive l'avancement du rang du statut parmi les statuts non terminés, quand il n'y a pas de sous-tâches", () => {
    expect(taskProgress(todo, allStatuses, [])).toBe(0);
    expect(taskProgress(inProgress, allStatuses, [])).toBeCloseTo(1 / 3);
    expect(taskProgress(validation, allStatuses, [])).toBeCloseTo(2 / 3);
    expect(taskProgress(delivered, allStatuses, [])).toBe(1);
  });

  it("utilise la fraction de sous-tâches cochées quand il y en a, quel que soit le statut", () => {
    const subtasks = [{ done: true }, { done: true }, { done: false }, { done: false }];
    expect(taskProgress(todo, allStatuses, subtasks)).toBe(0.5);
    expect(taskProgress(delivered, allStatuses, subtasks)).toBe(0.5);
  });

  it("reste à 0 sans sous-tâches quand il n'y a qu'un seul statut non terminé", () => {
    expect(taskProgress(todo, [todo, delivered], [])).toBe(0);
  });
});

describe("isSubtaskOverdue", () => {
  it("n'est jamais en retard si elle est faite", () => {
    expect(isSubtaskOverdue({ done: true, dueDate: "2020-01-01" }, "2026-01-01")).toBe(false);
  });

  it("n'est pas en retard sans échéance", () => {
    expect(isSubtaskOverdue({ done: false, dueDate: null }, "2026-01-01")).toBe(false);
  });

  it("est en retard si l'échéance est strictement dépassée", () => {
    expect(isSubtaskOverdue({ done: false, dueDate: "2026-01-01" }, "2026-01-02")).toBe(true);
  });

  it("n'est pas en retard le jour même de l'échéance", () => {
    expect(isSubtaskOverdue({ done: false, dueDate: "2026-01-02" }, "2026-01-02")).toBe(false);
  });
});

describe("hasDependencyConflict", () => {
  it("signale un conflit quand la dépendante commence avant la fin de la prédécesseure", () => {
    const predecessor = { startDate: "2026-01-01", endDate: "2026-01-10" };
    const dependent = { startDate: "2026-01-05", endDate: "2026-01-15" };
    expect(hasDependencyConflict(dependent, predecessor)).toBe(true);
  });

  it("signale un conflit quand les deux tâches se touchent le même jour", () => {
    const predecessor = { startDate: "2026-01-01", endDate: "2026-01-10" };
    const dependent = { startDate: "2026-01-10", endDate: "2026-01-15" };
    expect(hasDependencyConflict(dependent, predecessor)).toBe(true);
  });

  it("ne signale aucun conflit quand la dépendante commence après la fin de la prédécesseure", () => {
    const predecessor = { startDate: "2026-01-01", endDate: "2026-01-10" };
    const dependent = { startDate: "2026-01-11", endDate: "2026-01-15" };
    expect(hasDependencyConflict(dependent, predecessor)).toBe(false);
  });
});
