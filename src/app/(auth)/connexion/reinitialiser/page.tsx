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
    <div className="w-full max-w-sm border border-heading bg-paper p-8">
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
        Nouveau mot de passe
      </h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="border border-alert bg-alert-wash px-3 py-2 text-sm text-alert">
          Lien invalide — vérifiez que vous avez copié l’adresse complète depuis le courriel.
        </p>
      )}
    </div>
  );
}
