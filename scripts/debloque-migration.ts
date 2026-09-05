/**
 * Libère le verrou d'avis laissé par une migration interrompue.
 *
 * `prisma migrate deploy` prend `pg_advisory_lock(72707369)`, lié à la
 * session. Exécuté à travers PgBouncer — ce que faisait le build avant que
 * prisma.config.ts passe à la connexion directe — le verrou reste accroché à
 * une connexion applicative recyclée et n'est jamais relâché. Tout
 * déploiement suivant échoue alors en P1002 « Timed out trying to acquire a
 * postgres advisory lock ».
 *
 * Ce script ne coupe que les sessions *inactives* qui retiennent ce verrou
 * précis. Une migration réellement en cours (état « active ») n'est pas
 * touchée : si le script ne trouve rien à couper, c'est qu'un déploiement
 * migre au même moment — attendez sa fin.
 *
 *   ( set -a; . ./.env.production; set +a; \
 *     DATABASE_URL="$DATABASE_URL_UNPOOLED" npx tsx scripts/debloque-migration.ts )
 *
 * La connexion directe (non poolée) est nécessaire : à travers le pool, on ne
 * s'adresse pas forcément au backend qui détient le verrou.
 */
import "dotenv/config";
import { db } from "../src/lib/db";

/** Identifiant du verrou pris par Prisma, stable d'une version à l'autre. */
const VERROU = 72707369;

async function main() {
  const avant = await db.$queryRaw<Array<{ pid: number; state: string | null }>>`
    SELECT a.pid, a.state
    FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory' AND l.objid = ${VERROU}`;

  if (avant.length === 0) {
    console.log("Aucun verrou de migration en cours — rien à faire.");
    return;
  }
  console.log("Sessions détenant le verrou :", avant);

  const coupees = await db.$queryRaw<Array<{ pid: number }>>`
    SELECT a.pid
    FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory' AND l.objid = ${VERROU} AND a.state = 'idle'
      AND pg_terminate_backend(a.pid)`;

  const reste = await db.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND objid = ${VERROU}`;

  console.log(`${coupees.length} session(s) inactive(s) libérée(s) ; ${reste[0]?.n ?? 0} détenteur(s) restant(s).`);
  if ((reste[0]?.n ?? 0) > 0) {
    console.log("Il reste un détenteur actif : une migration tourne sans doute en ce moment. Relancez le déploiement après sa fin.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
