import { redirect } from "next/navigation";

/**
 * « Mes tâches » et « Tâches » étaient deux entrées de menu pour le même
 * tableau, à un filtre près. L'entrée a disparu au profit d'une bascule dans
 * Tâches, qui s'ouvre sur son propre travail. L'adresse reste valide : elle
 * est dans des favoris, et dans des courriels déjà envoyés.
 */
export default function MesTachesPage() {
  redirect("/taches");
}
