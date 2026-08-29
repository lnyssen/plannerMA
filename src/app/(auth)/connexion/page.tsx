import type { Metadata } from "next";
import { ConnexionForm } from "./connexion-form";

export const metadata: Metadata = { title: "Connexion — Planning des studios" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ depuis?: string }>;
}) {
  const { depuis } = await searchParams;
  const redirectTo = depuis && depuis.startsWith("/") ? depuis : "/projets";

  return (
    <div className="w-full max-w-sm border border-line bg-paper p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Média Animation
      </p>
      <h1 className="mt-1 mb-6 font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
        Planning des studios
      </h1>
      <ConnexionForm redirectTo={redirectTo} />
    </div>
  );
}
