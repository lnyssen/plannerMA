import type { Role } from "@prisma/client";

// next-auth (v5 beta) ré-exporte ses types depuis @auth/core : c'est là que
// les interfaces sont réellement déclarées, donc c'est là qu'il faut
// augmenter — une augmentation sur le module "next-auth" lui-même ne
// fusionne pas à travers un `export type { ... } from "@auth/core/..."`.
declare module "@auth/core/types" {
  interface User {
    role: Role;
    personId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      personId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    personId: string | null;
  }
}
