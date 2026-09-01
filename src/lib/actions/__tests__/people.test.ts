// Couvre invitePerson/resetPassword — jusqu'ici seules les fonctions pures
// (src/lib/planning) avaient des tests. `db`/`auth`/`sendMail`/`next/cache`
// sont simulés (voir vitest.config.ts pour l'alias "@" que ces mocks
// utilisent) ; bcryptjs reste réel pour vérifier que le mot de passe généré
// correspond bien au hash stocké, pas seulement que les fonctions sont
// appelées.

import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, sendMailMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sendMailMock: vi.fn(),
  dbMock: {
    person: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    journalEntry: { create: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/mail/transport", () => ({ sendMail: sendMailMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { invitePerson, resetPassword } = await import("../people");

const ADMIN_SESSION = {
  user: { id: "u-admin", personId: "p-admin", role: "ADMIN" as const, name: "Eléna Petit", email: "elena@media-animation.be" },
};
const COLLABORATOR_SESSION = {
  user: { id: "u-collab", personId: "p-collab", role: "COLLABORATOR" as const, name: "Bilal", email: "bilal@media-animation.be" },
};

// Alphabet exact de generateTemporaryPassword (src/lib/actions/people.ts) —
// dupliqué ici plutôt qu'exporté, pour vérifier le format depuis l'extérieur
// comme le ferait n'importe quel consommateur du mot de passe généré.
const PASSWORD_ALPHABET = /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{14}$/;

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("invitePerson", () => {
  it("refuse pour un compte non-admin, sans toucher la base", async () => {
    authMock.mockResolvedValue(COLLABORATOR_SESSION);

    const result = await invitePerson("person-1", { email: "test@media-animation.be", role: "COLLABORATOR" });

    expect(result.error).toBe("Réservé aux administrateurs.");
    expect(dbMock.person.findUnique).not.toHaveBeenCalled();
  });

  it("refuse si la personne a déjà un compte de connexion", async () => {
    authMock.mockResolvedValue(ADMIN_SESSION);
    dbMock.person.findUnique.mockResolvedValue({
      id: "person-1",
      name: "Chloé",
      email: null,
      user: { id: "existing-user" },
    });

    const result = await invitePerson("person-1", { email: "chloe@media-animation.be", role: "COLLABORATOR" });

    expect(result.error).toBe("Cette personne a déjà un compte de connexion.");
    expect(dbMock.user.create).not.toHaveBeenCalled();
  });

  it("crée le compte et renvoie un mot de passe valide quand le courriel part", async () => {
    authMock.mockResolvedValue(ADMIN_SESSION);
    dbMock.person.findUnique.mockResolvedValue({ id: "person-1", name: "Chloé", email: null, user: null });
    dbMock.user.findUnique.mockResolvedValue(null);
    sendMailMock.mockResolvedValue(undefined);

    const result = await invitePerson("person-1", { email: "chloe@media-animation.be", role: "COLLABORATOR" });

    expect(result.error).toBeUndefined();
    expect(result.emailSent).toBe(true);
    expect(result.temporaryPassword).toMatch(PASSWORD_ALPHABET);
    expect(sendMailMock).toHaveBeenCalledOnce();
    expect(dbMock.$transaction).toHaveBeenCalledOnce();

    // Le hash enregistré doit correspondre au mot de passe réellement renvoyé
    // à l'admin — sinon la personne invitée ne pourrait jamais se connecter
    // avec le mot de passe qu'on vient de lui montrer.
    const createCall = dbMock.user.create.mock.calls[0][0];
    const matches = await bcrypt.compare(result.temporaryPassword!, createCall.data.passwordHash);
    expect(matches).toBe(true);
  });

  it("renvoie quand même le mot de passe si l'envoi du courriel échoue (SMTP absent en production)", async () => {
    authMock.mockResolvedValue(ADMIN_SESSION);
    dbMock.person.findUnique.mockResolvedValue({ id: "person-1", name: "Chloé", email: null, user: null });
    dbMock.user.findUnique.mockResolvedValue(null);
    sendMailMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await invitePerson("person-1", { email: "chloe@media-animation.be", role: "COLLABORATOR" });

    expect(result.error).toContain("courriel a échoué");
    expect(result.emailSent).toBe(false);
    expect(result.temporaryPassword).toMatch(PASSWORD_ALPHABET);
  });
});

describe("resetPassword", () => {
  it("refuse pour une personne sans compte de connexion", async () => {
    authMock.mockResolvedValue(ADMIN_SESSION);
    dbMock.person.findUnique.mockResolvedValue({ id: "person-1", name: "Chloé", user: null });

    const result = await resetPassword("person-1");

    expect(result.error).toBe("Cette personne n’a pas de compte de connexion.");
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("régénère le mot de passe d'un compte existant", async () => {
    authMock.mockResolvedValue(ADMIN_SESSION);
    dbMock.person.findUnique.mockResolvedValue({
      id: "person-1",
      name: "Chloé",
      user: { id: "user-1", email: "chloe@media-animation.be" },
    });
    sendMailMock.mockResolvedValue(undefined);

    const result = await resetPassword("person-1");

    expect(result.emailSent).toBe(true);
    expect(result.temporaryPassword).toMatch(PASSWORD_ALPHABET);
    const updateCall = dbMock.user.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "user-1" });
    const matches = await bcrypt.compare(result.temporaryPassword!, updateCall.data.passwordHash);
    expect(matches).toBe(true);
  });

  it("renvoie quand même le mot de passe si l'envoi du courriel échoue", async () => {
    authMock.mockResolvedValue(ADMIN_SESSION);
    dbMock.person.findUnique.mockResolvedValue({
      id: "person-1",
      name: "Chloé",
      user: { id: "user-1", email: "chloe@media-animation.be" },
    });
    sendMailMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await resetPassword("person-1");

    expect(result.error).toContain("courriel a échoué");
    expect(result.emailSent).toBe(false);
    expect(result.temporaryPassword).toMatch(PASSWORD_ALPHABET);
  });
});
