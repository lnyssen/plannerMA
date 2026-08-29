import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 exige un adaptateur explicite à l'exécution (voir prisma.config.ts
// pour la configuration équivalente côté CLI). On garde une seule instance en
// développement pour éviter d'ouvrir un nouveau pool de connexions à chaque
// rechargement à chaud du serveur Next.js.

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
