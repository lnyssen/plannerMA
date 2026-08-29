// Configuration de la CLI Prisma (migrations, `prisma studio`, seed).
// Depuis Prisma 7, l'URL de connexion utilisée par la CLI se déclare ici,
// séparément de celle utilisée par l'application à l'exécution
// (voir src/lib/db.ts, qui passe par l'adaptateur @prisma/adapter-pg).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
