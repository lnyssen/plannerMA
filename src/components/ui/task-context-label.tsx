// Rendu visuel de la nomenclature Client — Projet — Tâche (voir
// src/lib/planning/labels.ts pour l'équivalent texte brut, utilisé dans les
// <select> natifs qui ne peuvent pas afficher de mise en forme).
export function TaskContextLabelParts({
  task,
}: {
  task: { title: string; project: { name: string; client: { name: string } } | null };
}) {
  if (!task.project) return <>{task.title}</>;
  return (
    <>
      <strong className="font-bold">{task.project.client.name}</strong>
      {" — "}
      {task.project.name}
      {" — "}
      {task.title}
    </>
  );
}
