import type { Metadata } from "next";
import { ConnexionForm } from "./connexion-form";

export const metadata: Metadata = { title: "Connexion — Studio planner" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ depuis?: string }>;
}) {
  const { depuis } = await searchParams;
  // "/" (pas "/projets" en dur) : la racine redirige elle-même selon le
  // rôle — admin vers Projets, les autres vers Aujourd'hui (voir
  // src/app/page.tsx) — pour ne pas dupliquer cette décision ici.
  const redirectTo = depuis && depuis.startsWith("/") ? depuis : "/";

  return (
    <div className="w-full max-w-sm border border-heading bg-paper p-8">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo bitmap fourni tel quel */}
      <img src="/logo/media-animation-couleur.png" alt="Média Animation" className="mb-4 h-9 w-auto" />
      <h1 className="mb-6 font-[family-name:var(--font-display)] text-lg font-semibold tracking-[-0.1px] text-heading">
        Studio planner
      </h1>
      <ConnexionForm redirectTo={redirectTo} />
    </div>
  );
}
