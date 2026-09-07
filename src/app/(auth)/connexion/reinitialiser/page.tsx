import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe — Studio planner" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-[0_16px_40px_-12px_rgba(45,21,146,0.18)]">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
        Nouveau mot de passe
      </h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="rounded-lg border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          Lien invalide — vérifiez que vous avez copié l’adresse complète depuis le courriel.
        </p>
      )}
    </div>
  );
}
