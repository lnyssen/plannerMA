import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GanttTask } from "@/lib/data/gantt";
import { GanttMobile } from "../gantt-mobile";

// Le composant navigue au clic ; hors du routeur Next il faut le doubler.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

function tache(over: Partial<Record<string, unknown>> & { id: string; startDate: string; endDate: string }): GanttTask {
  return {
    title: "Tâche",
    assignee: null,
    project: null,
    studios: [],
    dependsOnId: null,
    ...over,
    startDate: new Date(`${over.startDate}T00:00:00.000Z`),
    endDate: new Date(`${over.endDate}T00:00:00.000Z`),
  } as unknown as GanttTask;
}

const RIEN = new Set<string>();
const SANS_TITRE = new Map<string, string>();

describe("GanttMobile", () => {
  it("groupe les tâches par semaine de démarrage, dans l'ordre", () => {
    const html = renderToStaticMarkup(
      <GanttMobile
        tasks={[
          tache({ id: "b", title: "Montage", startDate: "2026-09-14", endDate: "2026-09-18" }),
          tache({ id: "a", title: "Tournage", startDate: "2026-09-08", endDate: "2026-09-09" }),
        ]}
        overlappingTaskIds={RIEN}
        titreParId={SANS_TITRE}
      />,
    );

    expect(html).toContain("Semaine du 7 sept.");
    expect(html).toContain("Semaine du 14 sept.");
    // La plus ancienne d'abord, quel que soit l'ordre reçu.
    expect(html.indexOf("Tournage")).toBeLessThan(html.indexOf("Montage"));
  });

  it("écrit les dates plutôt que de les dessiner", () => {
    const html = renderToStaticMarkup(
      <GanttMobile
        tasks={[tache({ id: "a", startDate: "2026-09-08", endDate: "2026-09-11" })]}
        overlappingTaskIds={RIEN}
        titreParId={SANS_TITRE}
      />,
    );

    expect(html).toContain("8 sept.");
    expect(html).toContain("11 sept.");
  });

  it("signale l'échéance dépassée, le chevauchement et la dépendance", () => {
    const html = renderToStaticMarkup(
      <GanttMobile
        tasks={[tache({ id: "a", startDate: "2020-01-06", endDate: "2020-01-08", dependsOnId: "z" })]}
        overlappingTaskIds={new Set(["a"])}
        titreParId={new Map([["z", "Repérages"]])}
      />,
    );

    expect(html).toContain("échéance dépassée");
    expect(html).toContain("chevauche une autre tâche");
    expect(html).toContain("Repérages");
  });

  it("ne signale rien sur une tâche à venir, sans chevauchement ni dépendance", () => {
    const html = renderToStaticMarkup(
      <GanttMobile
        tasks={[tache({ id: "a", startDate: "2099-01-05", endDate: "2099-01-09" })]}
        overlappingTaskIds={RIEN}
        titreParId={SANS_TITRE}
      />,
    );

    expect(html).not.toContain("échéance dépassée");
    expect(html).not.toContain("chevauche une autre tâche");
    expect(html).not.toContain("après «");
  });

  it("affiche un message plutôt qu'une liste vide", () => {
    const html = renderToStaticMarkup(
      <GanttMobile tasks={[]} overlappingTaskIds={RIEN} titreParId={SANS_TITRE} />,
    );

    expect(html).toContain("Aucune tâche sur cette période.");
  });
});
