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
