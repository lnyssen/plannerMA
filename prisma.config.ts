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
    // Les migrations prennent un verrou d'avis PostgreSQL, qui est lié à la
    // session. À travers PgBouncer, qui multiplexe les sessions, le verrou
    // reste accroché à une connexion recyclée et n'est jamais relâché : les
    // déploiements suivants échouaient tous en P1002 « Timed out trying to
    // acquire a postgres advisory lock ». La CLI passe donc par la connexion
    // directe quand elle existe (DATABASE_URL_UNPOOLED, posée par
    // l'intégration Neon) ; l'application, elle, garde le pool — voir
    // src/lib/db.ts.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
