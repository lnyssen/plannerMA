import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié — Studio planner" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-paper p-8 shadow-[0_16px_40px_-12px_rgba(45,21,146,0.18)]">
      <h1 className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
        Mot de passe oublié
      </h1>
      <p className="mb-6 text-sm text-ink">
        Indiquez votre adresse courriel — si un compte y est associé, un lien de réinitialisation vous sera envoyé.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
