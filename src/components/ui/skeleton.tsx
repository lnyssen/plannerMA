export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-wash ${className}`} />;
}

/** Pour les `loading.tsx` des fiches tâche/projet (page dédiée, plus la fenêtre d'un modal) — même silhouette que la vraie page : fil d'Ariane, titre, barre d'actions, corps deux colonnes. */
export function PageDetailSkeleton() {
  return (
    <div className="px-8 py-8">
      <Skeleton className="mb-3 h-4 w-40" />
      <Skeleton className="mb-6 h-8 w-72" />
      <Skeleton className="mb-6 h-14 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Approximation d'une fiche détail (titre + quelques lignes + bloc). */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
