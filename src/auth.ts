// Configuration Auth.js (NextAuth v5). Identifiants + mot de passe pour le
// démarrage ; conçu pour accueillir un provider Microsoft Entra ID plus
// tard (voir docs/plan-architecture.md) en ajoutant simplement un provider
// ici, sans toucher au reste — sessions JWT, pas d'adaptateur base de
// données requis pour des identifiants seuls.

import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
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
