// Couvre requestPasswordReset/resetPasswordWithToken — mêmes principes que
// people.test.ts (db/sendMail simulés, bcryptjs réel). Vérifié aussi en
// direct contre la vraie base (jeton valide/réutilisé/inconnu/expiré,
// restauration du mot de passe après coup) avant d'écrire ces tests.

import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, dbMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(),
  dbMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    journalEntry: { create: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/mail/transport", () => ({ sendMail: sendMailMock }));

const { requestPasswordReset, resetPasswordWithToken } = await import("../password-reset");

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("requestPasswordReset", () => {
  it("refuse une adresse mal formée sans toucher la base", async () => {
    const result = await requestPasswordReset("pas-une-adresse");
    expect(result.error).toBe("Adresse courriel invalide.");
    expect(dbMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("crée un jeton et tente l'envoi pour un compte existant", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "chloe@media-animation.be",
      person: { name: "Chloé" },
    });
    sendMailMock.mockResolvedValue(undefined);

    const result = await requestPasswordReset("Chloe@Media-Animation.be");

    expect(result.error).toBeUndefined();
    expect(dbMock.passwordResetToken.create).toHaveBeenCalledOnce();
    expect(sendMailMock).toHaveBeenCalledOnce();
    // Adresse normalisée en minuscules avant la recherche.
    expect(dbMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "chloe@media-animation.be" },
      include: { person: true },
    });
  });

  it("renvoie le même succès générique pour un compte inexistant (pas d'énumération)", async () => {
    dbMock.user.findUnique.mockResolvedValue(null);

    const result = await requestPasswordReset("personne@example.com");

    expect(result.error).toBeUndefined();
    expect(dbMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("réussit quand même si l'envoi du courriel échoue (SMTP absent en production)", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "chloe@media-animation.be",
      person: { name: "Chloé" },
    });
    sendMailMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await requestPasswordReset("chloe@media-animation.be");

    expect(result.error).toBeUndefined();
  });
});

describe("resetPasswordWithToken", () => {
  it("refuse un mot de passe trop court", async () => {
    const result = await resetPasswordWithToken({ token: "abc", password: "court" });
    expect(result.error).toContain("8 caractères");
    expect(dbMock.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it("refuse un jeton inconnu", async () => {
    dbMock.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await resetPasswordWithToken({ token: "jeton-inconnu", password: "MotDePasse123" });
    expect(result.error).toContain("n’est plus valide");
  });

  it("refuse un jeton déjà utilisé", async () => {
    dbMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const result = await resetPasswordWithToken({ token: "deja-utilise", password: "MotDePasse123" });
    expect(result.error).toContain("n’est plus valide");
  });

  it("refuse un jeton expiré", async () => {
    dbMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await resetPasswordWithToken({ token: "expire", password: "MotDePasse123" });
    expect(result.error).toContain("n’est plus valide");
  });

  it("met à jour le mot de passe pour un jeton valide, avec un hash qui correspond réellement", async () => {
    dbMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    dbMock.user.findUnique.mockResolvedValue({ id: "user-1", email: "chloe@media-animation.be", personId: "p-1", person: { name: "Chloé" } });

    const result = await resetPasswordWithToken({ token: "valide", password: "NouveauMotDePasse123" });

    expect(result.error).toBeUndefined();
    expect(dbMock.$transaction).toHaveBeenCalledOnce();
    const updateCall = dbMock.user.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "user-1" });
    const matches = await bcrypt.compare("NouveauMotDePasse123", updateCall.data.passwordHash);
    expect(matches).toBe(true);
  });
});
