// Le verrou ne vaut que s'il est appliqué. timesheets.test.ts vérifie qu'il
// répond juste ; ici on vérifie que chaque mutation d'écriture s'y plie —
// et qu'aucune n'écrit malgré tout en base.
//
// La feuille est simulée « remise » (SUBMITTED) via timesheetPeriod, donc le
// vrai timesheetLockFor est exercé, pas un doublon.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: {
    timesheetPeriod: { findUnique: vi.fn() },
    timeEntry: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    task: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    notification: { findFirst: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../notifications", () => ({ createNotification: vi.fn() }));

const { startTimer, stopTimer, addManualEntry, createTimeEntryAt, updateTimeEntryTimes, deleteTimeEntry } =
  await import("../time-entries");

const MOI = { user: { id: "u1", personId: "p1", role: "COLLABORATOR" as const, name: "Bilal", email: "b@x.be" } };
const CONTEXTE = { studioId: "s1", projectId: null, taskId: null, categoryId: null };
const MOIS_VERROUILLE = "2026-03";
const DANS_LE_MOIS = "2026-03-10T09:00:00.000Z";

/** Toutes les écritures en base, tous verbes confondus. */
function ecrituresEnBase() {
  return [
    ...dbMock.timeEntry.create.mock.calls,
    ...dbMock.timeEntry.update.mock.calls,
    ...dbMock.timeEntry.updateMany.mock.calls,
    ...dbMock.timeEntry.delete.mock.calls,
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(MOI);
  // La feuille de mars est remise : tout mars est fermé.
  dbMock.timesheetPeriod.findUnique.mockImplementation(({ where }: { where: { personId_month: { month: Date } } }) => {
    const m = where.personId_month.month;
    const cle = `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`;
    return Promise.resolve(cle === MOIS_VERROUILLE ? { status: "SUBMITTED" } : null);
  });
  dbMock.timeEntry.findFirst.mockResolvedValue(null);
  dbMock.project.findUnique.mockResolvedValue({ archived: false, id: "pr1", name: "P", budgetHours: null });
  dbMock.timeEntry.findMany.mockResolvedValue([]);
  dbMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

const REFUS = /remise pour validation/;

describe("le verrou refuse toute écriture dans un mois remis", () => {
  it("addManualEntry", async () => {
    const r = await addManualEntry({ ...CONTEXTE, date: "2026-03-10", hours: 2, minutes: 0, note: null });
    expect(r.error).toMatch(REFUS);
    expect(ecrituresEnBase()).toHaveLength(0);
  });

  it("createTimeEntryAt", async () => {
    const r = await createTimeEntryAt({
      ...CONTEXTE,
      startedAt: DANS_LE_MOIS,
      endedAt: "2026-03-10T11:00:00.000Z",
    });
    expect(r.error).toMatch(REFUS);
    expect(ecrituresEnBase()).toHaveLength(0);
  });

  it("deleteTimeEntry", async () => {
    dbMock.timeEntry.findUnique.mockResolvedValue({ personId: "p1", startedAt: new Date(DANS_LE_MOIS) });
    const r = await deleteTimeEntry("e1");
    expect(r.error).toMatch(REFUS);
    expect(dbMock.timeEntry.delete).not.toHaveBeenCalled();
  });

  it("updateTimeEntryTimes", async () => {
    dbMock.timeEntry.findUnique.mockResolvedValue({
      personId: "p1",
      startedAt: new Date(DANS_LE_MOIS),
      endedAt: new Date("2026-03-10T11:00:00.000Z"),
      projectId: null,
    });
    const r = await updateTimeEntryTimes({
      entryId: "e1",
      startedAt: "2026-03-10T14:00:00.000Z",
      endedAt: "2026-03-10T16:00:00.000Z",
    });
    expect(r.error).toMatch(REFUS);
    expect(dbMock.timeEntry.update).not.toHaveBeenCalled();
  });
});

// Un déplacement touche deux mois : celui d'où l'écriture part et celui où
// elle arrive. Ne contrôler qu'un seul des deux laisserait un mois verrouillé
// se vider ou se remplir par le bord.
describe("updateTimeEntryTimes contrôle les deux mois", () => {
  const AVRIL_DEBUT = "2026-04-08T09:00:00.000Z";
  const AVRIL_FIN = "2026-04-08T11:00:00.000Z";

  it("refuse de sortir une écriture d’un mois verrouillé", async () => {
    dbMock.timeEntry.findUnique.mockResolvedValue({
      personId: "p1",
      startedAt: new Date(DANS_LE_MOIS), // mars, verrouillé
      endedAt: new Date("2026-03-10T11:00:00.000Z"),
      projectId: null,
    });
    const r = await updateTimeEntryTimes({ entryId: "e1", startedAt: AVRIL_DEBUT, endedAt: AVRIL_FIN });
    expect(r.error).toMatch(REFUS);
    expect(dbMock.timeEntry.update).not.toHaveBeenCalled();
  });

  it("refuse de faire entrer une écriture dans un mois verrouillé", async () => {
    dbMock.timeEntry.findUnique.mockResolvedValue({
      personId: "p1",
      startedAt: new Date(AVRIL_DEBUT), // avril, ouvert
      endedAt: new Date(AVRIL_FIN),
      projectId: null,
    });
    const r = await updateTimeEntryTimes({
      entryId: "e1",
      startedAt: DANS_LE_MOIS,
      endedAt: "2026-03-10T11:00:00.000Z",
    });
    expect(r.error).toMatch(REFUS);
    expect(dbMock.timeEntry.update).not.toHaveBeenCalled();
  });

  it("laisse passer un déplacement entre deux mois ouverts", async () => {
    dbMock.timeEntry.findUnique.mockResolvedValue({
      personId: "p1",
      startedAt: new Date(AVRIL_DEBUT),
      endedAt: new Date(AVRIL_FIN),
      projectId: null,
    });
    dbMock.timeEntry.update.mockResolvedValue({});
    const r = await updateTimeEntryTimes({
      entryId: "e1",
      startedAt: "2026-05-08T09:00:00.000Z",
      endedAt: "2026-05-08T11:00:00.000Z",
    });
    expect(r.error).toBeUndefined();
    expect(dbMock.timeEntry.update).toHaveBeenCalledOnce();
  });
});

describe("ce que le verrou laisse passer", () => {
  it("une écriture dans un mois ouvert", async () => {
    dbMock.timeEntry.create.mockResolvedValue({ projectId: null });
    const r = await addManualEntry({ ...CONTEXTE, date: "2026-04-10", hours: 2, minutes: 0, note: null });
    expect(r.error).toBeUndefined();
    expect(dbMock.timeEntry.create).toHaveBeenCalledOnce();
  });

  // Exemption assumée : un minuteur lancé avant la remise doit pouvoir être
  // arrêté, sinon il tourne indéfiniment et fausse le mois suivant.
  it("l’arrêt d’un minuteur, même dans un mois verrouillé", async () => {
    dbMock.timeEntry.findUnique.mockResolvedValue({
      personId: "p1",
      startedAt: new Date(DANS_LE_MOIS),
      endedAt: null,
      projectId: null,
    });
    dbMock.timeEntry.update.mockResolvedValue({ projectId: null });
    const r = await stopTimer("e1");
    expect(r.error).toBeUndefined();
    expect(dbMock.timeEntry.update).toHaveBeenCalledOnce();
  });
});

describe("le verrou porte sur la personne de l’écriture, pas sur l’auteur", () => {
  it("un administrateur ne contourne pas la feuille remise d’un collègue", async () => {
    authMock.mockResolvedValue({ user: { ...MOI.user, personId: "p-admin", role: "ADMIN" as const } });
    dbMock.timeEntry.findUnique.mockResolvedValue({ personId: "p1", startedAt: new Date(DANS_LE_MOIS) });
    const r = await deleteTimeEntry("e1");
    expect(r.error).toMatch(REFUS);
    expect(dbMock.timesheetPeriod.findUnique.mock.calls[0][0].where.personId_month.personId).toBe("p1");
    expect(dbMock.timeEntry.delete).not.toHaveBeenCalled();
  });
});

describe("startTimer", () => {
  it("refuse de démarrer dans un mois verrouillé", async () => {
    vi.setSystemTime(new Date("2026-03-10T09:00:00.000Z"));
    const r = await startTimer(CONTEXTE);
    expect(r.error).toMatch(REFUS);
    expect(ecrituresEnBase()).toHaveLength(0);
    vi.useRealTimers();
  });
});
