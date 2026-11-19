// Configuration Auth.js (NextAuth v5). Identifiants + mot de passe pour le
// démarrage ; conçu pour accueillir un provider Microsoft Entra ID plus
// tard (voir docs/plan-architecture.md) en ajoutant simplement un provider
// ici, sans toucher au reste — sessions JWT, pas d'adaptateur base de
// données requis pour des identifiants seuls.

import bcrypt from "bcryptjs";
import NextAuth, { type Session } from "next-auth";
import { cache } from "react";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { ACCES_DIRECT } from "@/lib/auth/acces-direct";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth: nextAuth, signIn, signOut } = NextAuth({
  // Sans ça, Auth.js v5 refuse l'en-tête d'hôte fourni par la plateforme
  // (Vercel, ou tout hébergeur derrière un proxy) et échoue avec une erreur
  // de configuration générique — sûr ici : c'est Vercel/le proxy amont qui
  // pose l'en-tête, pas une requête cliente arbitraire.
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Courriel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { person: true },
        });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        return {
          id: user.id,
          email: user.email,
          name: user.person?.name ?? user.email,
          role: user.role,
          personId: user.personId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.personId = user.personId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.personId = token.personId;
      return session;
    },
  },
});

/**
 * Compte utilisé quand l'accès direct est actif et qu'aucune session n'existe
 * (voir src/lib/auth/acces-direct.ts). Mis en cache le temps d'une requête :
 * `auth()` est appelé des dizaines de fois par rendu.
 */
const defaultSession = cache(async (): Promise<Session | null> => {
  const email = process.env.ACCES_DIRECT_EMAIL?.trim().toLowerCase();
  const user =
    (email ? await db.user.findUnique({ where: { email }, include: { person: true } }) : null) ??
    (await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, include: { person: true } })) ??
    (await db.user.findFirst({ orderBy: { createdAt: "asc" }, include: { person: true } }));
  if (!user) return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.person?.name ?? user.email,
      role: user.role,
      personId: user.personId,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
});

/**
 * Session courante. Avec l'accès direct actif, retombe sur le compte par
 * défaut au lieu de renvoyer null — tout le reste de l'application (pages,
 * actions, exports) continue donc de fonctionner sans modification.
 */
export async function auth(): Promise<Session | null> {
  const session = await nextAuth();
  if (session?.user || !ACCES_DIRECT) return session;
  return defaultSession();
}
