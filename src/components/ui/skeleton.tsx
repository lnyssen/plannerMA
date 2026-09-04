export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-wash ${className}`} />;
}

/** Pour les `loading.tsx` des fiches tâche/projet (page dédiée, plus la fenêtre d'un modal) — même silhouette que la vraie page : fil d'Ariane, titre, barre d'actions, corps deux colonnes. */
export function PageDetailSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
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

/**
 * Pour les `loading.tsx` des pages de liste (Tâches, Projets, Temps, Équipe,
 * Tableau de bord, Aujourd'hui, Clients, Charge, Planning…) — silhouette
 * générique titre + barre de filtres + lignes, plutôt qu'un flash de page
 * vide le temps que les données arrivent. Chaque page reste assez proche de
 * cette forme pour qu'une seule silhouette serve partout, sans sur-adapter
 * à chacune.
 */
export function ListPageSkeleton() {
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="mb-5 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
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
