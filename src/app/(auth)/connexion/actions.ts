"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type AuthActionState = { error: string | null };

export async function authenticate(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/projets");

  try {
    await signIn("credentials", { email, password, redirectTo });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Courriel ou mot de passe incorrect." };
      }
      return { error: "Connexion impossible pour l’instant. Réessayez." };
    }
    // Auth.js signale une redirection réussie en relançant une exception
    // interne : à laisser remonter, sinon la redirection n’a jamais lieu.
    throw error;
  }
}
