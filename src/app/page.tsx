import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Un compte admin atterrit sur Projets (vue d'ensemble) ; les autres sur
// Aujourd'hui (leurs tâches du jour, minuteur, absences) — voir
// src/app/(app)/aujourdhui, qui n'a de sens que pour son propre travail,
// pas pour piloter toute l'équipe.
export default async function Home() {
  const session = await auth();
  redirect(session?.user.role === "ADMIN" ? "/projets" : "/aujourdhui");
}
