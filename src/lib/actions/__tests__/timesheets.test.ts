// Le verrouillage des feuilles de temps est le code le plus sensible de
// l'application : il décide si une écriture peut encore être modifiée. Il
// n'avait aucun test. `db`/`auth`/`next/cache` sont simulés (voir
// vitest.config.ts pour l'alias « @ » utilisé par ces mocks).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: {
    timesheetPeriod: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    timeEntry: { findMany: vi.fn() },
    journalEntry: { create: vi.fn() },
    person: { findUnique: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { timesheetLockFor, submitTimesheet, reviewTimesheet } = await import("../timesheets");

const MOI = { user: { id: "u1", personId: "p1", role: "COLLABORATOR" as const, name: "Bilal", email: "b@x.be" } };
const ADMIN = { user: { id: "u2", personId: "p2", role: "ADMIN" as const, name: "Eléna", email: "e@x.be" } };

/** Un mois révolu, pour ne pas buter sur « ce mois n'est pas terminé ». */
function moisPasse(recul = 2): string {
  const n = new Date();
  const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - recul, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.journalEntry.create.mockResolvedValue({});
  dbMock.person.findUnique.mockResolvedValue({ name: "Bilal" });
});

describe("timesheetLockFor", () => {
  it("ne bloque rien quand aucune feuille n’existe pour ce mois", async () => {
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(null);
    expect(await timesheetLockFor("p1", new Date("2026-03-15T10:00:00Z"))).toBeNull();
  });

  it("ne bloque rien tant que la feuille est un brouillon", async () => {
    dbMock.timesheetPeriod.findUnique.mockResolvedValue({ status: "DRAFT" });
    expect(await timesheetLockFor("p1", new Date("2026-03-15T10:00:00Z"))).toBeNull();
  });

  it("bloque une feuille remise, en disant comment la rouvrir", async () => {
    dbMock.timesheetPeriod.findUnique.mockResolvedValue({ status: "SUBMITTED" });
    const message = await timesheetLockFor("p1", new Date("2026-03-15T10:00:00Z"));
    expect(message).toMatch(/remise pour validation/);
    expect(message).toMatch(/réouverture/);
  });

  it("bloque une feuille validée", async () => {
    dbMock.timesheetPeriod.findUnique.mockResolvedValue({ status: "APPROVED" });
    expect(await timesheetLockFor("p1", new Date("2026-03-15T10:00:00Z"))).toMatch(/validée et verrouillée/);
  });

  // Le verrou porte sur le couple personne/mois : c'est là que se joue la
  // justesse. Une erreur d'un jour ferait chercher le mauvais mois aux bords.
  it("ramène n’importe quelle date au premier jour de son mois, en UTC", async () => {
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(null);
    for (const date of ["2026-03-01T00:00:00Z", "2026-03-15T12:00:00Z", "2026-03-31T23:59:59Z"]) {
      await timesheetLockFor("p1", new Date(date));
    }
    for (const appel of dbMock.timesheetPeriod.findUnique.mock.calls) {
      expect(appel[0].where.personId_month.month).toEqual(new Date(Date.UTC(2026, 2, 1)));
    }
  });

  it("interroge bien la feuille de la personne concernée", async () => {
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(null);
    await timesheetLockFor("p-quelquun-dautre", new Date("2026-03-15T10:00:00Z"));
    expect(dbMock.timesheetPeriod.findUnique.mock.calls[0][0].where.personId_month.personId).toBe("p-quelquun-dautre");
  });
});

describe("submitTimesheet", () => {
  it("refuse un compte sans fiche personne", async () => {
    authMock.mockResolvedValue({ user: { ...MOI.user, personId: null } });
    expect((await submitTimesheet(moisPasse())).error).toMatch(/aucune fiche personne/);
  });

  it("refuse un mois mal formé", async () => {
    authMock.mockResolvedValue(MOI);
    expect((await submitTimesheet("mars 2026")).error).toMatch(/Mois invalide/);
  });

  // Remettre un mois en cours enfermerait derrière le verrou des jours pas
  // encore saisis.
  it("refuse le mois en cours", async () => {
    authMock.mockResolvedValue(MOI);
    const n = new Date();
    const enCours = `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
    expect((await submitTimesheet(enCours)).error).toMatch(/n’est pas terminé/);
    expect(dbMock.timesheetPeriod.upsert).not.toHaveBeenCalled();
  });

  it("refuse une feuille déjà remise", async () => {
    authMock.mockResolvedValue(MOI);
    dbMock.timesheetPeriod.findUnique.mockResolvedValue({ status: "SUBMITTED" });
    expect((await submitTimesheet(moisPasse())).error).toMatch(/déjà remise/);
    expect(dbMock.timesheetPeriod.upsert).not.toHaveBeenCalled();
  });

  it("remet un mois révolu et le consigne au journal", async () => {
    authMock.mockResolvedValue(MOI);
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(null);
    dbMock.timesheetPeriod.upsert.mockResolvedValue({});
    const mois = moisPasse();

    expect(await submitTimesheet(mois)).toEqual({});
    const upsert = dbMock.timesheetPeriod.upsert.mock.calls[0][0];
    expect(upsert.update.status).toBe("SUBMITTED");
    expect(upsert.create.personId).toBe("p1");
    // Le motif d'une réouverture précédente ne doit pas survivre à la remise.
    expect(upsert.update.note).toBeNull();
    expect(dbMock.journalEntry.create.mock.calls[0][0].data.action).toContain(mois);
  });

  it("repart d’un brouillon rouvert", async () => {
    authMock.mockResolvedValue(MOI);
    dbMock.timesheetPeriod.findUnique.mockResolvedValue({ status: "DRAFT" });
    dbMock.timesheetPeriod.upsert.mockResolvedValue({});
    expect(await submitTimesheet(moisPasse())).toEqual({});
    expect(dbMock.timesheetPeriod.upsert).toHaveBeenCalled();
  });
});

describe("reviewTimesheet", () => {
  const PERIODE = { id: "t1", month: new Date(Date.UTC(2026, 2, 1)), person: { name: "Bilal" } };

  it("refuse un non-administrateur", async () => {
    authMock.mockResolvedValue(MOI);
    expect((await reviewTimesheet({ periodId: "t1", decision: "approve" })).error).toMatch(/administrateurs/);
    expect(dbMock.timesheetPeriod.update).not.toHaveBeenCalled();
  });

  it("refuse une feuille introuvable", async () => {
    authMock.mockResolvedValue(ADMIN);
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(null);
    expect((await reviewTimesheet({ periodId: "inconnu", decision: "approve" })).error).toMatch(/introuvable/);
  });

  it("valide : la feuille passe en APPROVED et le motif est effacé", async () => {
    authMock.mockResolvedValue(ADMIN);
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(PERIODE);
    dbMock.timesheetPeriod.update.mockResolvedValue(PERIODE);

    expect(await reviewTimesheet({ periodId: "t1", decision: "approve", note: "ignoré" })).toEqual({});
    const data = dbMock.timesheetPeriod.update.mock.calls[0][0].data;
    expect(data.status).toBe("APPROVED");
    expect(data.note).toBeNull();
    expect(data.reviewedById).toBe("p2");
    expect(dbMock.journalEntry.create.mock.calls[0][0].data.action).toMatch(/validée/);
  });

  // La réouverture est la clé du verrou : sans elle, une erreur en base
  // resterait figée pour toujours.
  it("rouvre : retour en DRAFT, motif conservé", async () => {
    authMock.mockResolvedValue(ADMIN);
    dbMock.timesheetPeriod.findUnique.mockResolvedValue(PERIODE);
    dbMock.timesheetPeriod.update.mockResolvedValue(PERIODE);

    expect(await reviewTimesheet({ periodId: "t1", decision: "reopen", note: "Il manque le 12." })).toEqual({});
    const data = dbMock.timesheetPeriod.update.mock.calls[0][0].data;
    expect(data.status).toBe("DRAFT");
    expect(data.note).toBe("Il manque le 12.");
    expect(dbMock.journalEntry.create.mock.calls[0][0].data.action).toMatch(/rouverte/);
  });

  it("refuse une décision inconnue", async () => {
    authMock.mockResolvedValue(ADMIN);
    expect((await reviewTimesheet({ periodId: "t1", decision: "supprimer" as never })).error).toBeTruthy();
    expect(dbMock.timesheetPeriod.update).not.toHaveBeenCalled();
  });
});
