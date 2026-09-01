import { db } from "@/lib/db";

/**
 * Nom d'auteur pour une écriture de journal — jamais `session.user.name`
 * directement : figé dans le jeton JWT au moment de la connexion (stratégie
 * "jwt", voir src/auth.ts), il ne suit pas un renommage de la fiche personne
 * ensuite. Même correctif que (app)/layout.tsx pour l'affichage du menu,
 * appliqué ici pour chaque écriture de journal — sinon le nom affiché dans
 * l'historique reste celui d'avant un renommage, indéfiniment.
 */
export async function currentActorName(session: { user: { personId: string | null; email?: string | null } }): Promise<string> {
  if (session.user.personId) {
    const person = await db.person.findUnique({ where: { id: session.user.personId }, select: { name: true } });
    if (person) return person.name;
  }
  return session.user.email ?? "Anonyme";
}
