// Rendu visuel de la nomenclature Client — Projet — Tâche (voir
// src/lib/planning/labels.ts pour l'équivalent texte brut, utilisé dans les
// <select> natifs qui ne peuvent pas afficher de mise en forme) : trois
// paliers distincts — client en gras (couleur de marque), projet en
// semi-gras, tâche en poids normal — pour repérer chaque partie d'un coup
// d'œil dans une liste dense.
export function TaskContextLabelParts({
  task,
}: {
  task: { title: string; project: { name: string; client: { name: string } } | null };
}) {
  if (!task.project) return <>{task.title}</>;
  return (
    <>
      <strong className="font-bold text-heading">{task.project.client.name}</strong>
      {" — "}
      <span className="font-semibold">{task.project.name}</span>
      {" — "}
      <span className="font-normal">{task.title}</span>
    </>
  );
}

/**
 * Rendu visuel d'une écriture de temps — comme TaskContextLabelParts, mais
 * pour un TimeEntry (qui n'est plus forcément liée à une Task, voir
 * prisma/schema.prisma) : sans tâche, la queue du libellé est la Catégorie
 * plutôt qu'un titre de tâche, et "AGENCE" remplace le nom du client quand
 * il n'y a pas de projet.
 */
export function EntryContextLabelParts({
  entry,
}: {
  entry: {
    task: { title: string } | null;
    project: { name: string; client: { name: string } } | null;
    category: { name: string } | null;
  };
}) {
  const tail = entry.task ? entry.task.title : (entry.category?.name ?? "Sans catégorie");
  if (!entry.project) {
    return (
      <>
        <strong className="font-bold text-heading">AGENCE</strong>
        {" — "}
        <span className="font-normal">{tail}</span>
      </>
    );
  }
  return (
    <>
      <strong className="font-bold text-heading">{entry.project.client.name}</strong>
      {" — "}
      <span className="font-semibold">{entry.project.name}</span>
      {" — "}
      <span className="font-normal">{tail}</span>
    </>
  );
}
