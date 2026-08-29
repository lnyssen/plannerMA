export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Planning des studios
      </h1>
      <p className="max-w-md text-sm leading-6 text-neutral-600">
        Palier 1 (socle) en cours de construction : base de données, comptes
        et calculs sont en place, l’interface n’est pas encore branchée.
        Voir <code className="rounded bg-neutral-100 px-1 py-0.5">docs/plan-architecture.md</code>.
      </p>
    </div>
  );
}
