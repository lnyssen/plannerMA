// Calculs de dates purs, portés du prototype `planning-studios-v6.jsx`
// (fonctions `iso`, `lire`, `plus`, `lundiDe`, `ecart`, `weekEnd`, `paques`,
// `feriesDe`, `ferie`, `ouvrable`, lignes 53-105 du fichier source).
//
// Différence volontaire avec le prototype : tout est calculé en UTC plutôt
// qu'en fuseau local du navigateur. Le prototype tournait dans le navigateur
// de chaque utilisateur (fuseau Europe/Bruxelles par construction) ; ce
// module tourne côté serveur, où le fuseau du processus n'est pas garanti.
// Les colonnes `@db.Date` de Postgres sont lues par Prisma comme des dates à
// minuit UTC : rester en UTC de bout en bout évite tout décalage d'un jour
// selon l'heure et le fuseau du serveur d'hébergement.

/** Une date calendaire au format AAAA-MM-JJ, sans heure ni fuseau. */
export type IsoDate = string;

export function toIsoDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function fromIsoDate(s: IsoDate): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function addDaysIso(s: IsoDate, n: number): IsoDate {
  return toIsoDate(addDays(fromIsoDate(s), n));
}

/**
 * Ajoute `n` mois à une date ISO, en calant sur le dernier jour du mois cible
 * si le jour d'origine n'existe pas (ex. 31 janvier + 1 mois = 28/29
 * février). Utilisé pour décaler les tâches récurrentes mensuelles.
 */
export function addMonthsIso(s: IsoDate, n: number): IsoDate {
  const d = fromIsoDate(s);
  const targetMonthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  targetMonthStart.setUTCDate(Math.min(d.getUTCDate(), daysInTargetMonth));
  return toIsoDate(targetMonthStart);
}

/** Lundi de la semaine contenant `d` (semaine ISO, du lundi au dimanche). */
export function mondayOf(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
  return addDays(d, -dow);
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((fromIsoDate(b).getTime() - fromIsoDate(a).getTime()) / 86_400_000);
}

export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const;

/** Formate une date courte à la française, ex. "5 avril". */
export function formatShortFr(s: IsoDate): string {
  const d = fromIsoDate(s);
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()].slice(0, 4)}.`;
}

/** Formate une date longue à la française, ex. "5 avril 2026" — mois en toutes lettres, année incluse. */
export function formatLongFr(s: IsoDate): string {
  const d = fromIsoDate(s);
  return `${d.getUTCDate()} ${MONTHS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Plage de dates à la française, aussi compacte que possible : ex.
 * "Du 24 au 30 août 2026" (même mois), "Du 28 août au 3 septembre 2026"
 * (mois différents, même année), "Du 28 décembre 2026 au 3 janvier 2027"
 * (années différentes) — utilisé par l'en-tête du Gantt pour situer la
 * plage affichée sans avoir à déchiffrer les libellés de colonnes.
 */
export function formatRangeFr(a: IsoDate, b: IsoDate): string {
  const da = fromIsoDate(a);
  const db = fromIsoDate(b);
  if (da.getUTCFullYear() !== db.getUTCFullYear()) {
    return `Du ${formatLongFr(a)} au ${formatLongFr(b)}`;
  }
  if (da.getUTCMonth() !== db.getUTCMonth()) {
    return `Du ${da.getUTCDate()} ${MONTHS_FR[da.getUTCMonth()]} au ${formatLongFr(b)}`;
  }
  return `Du ${da.getUTCDate()} au ${db.getUTCDate()} ${MONTHS_FR[db.getUTCMonth()]} ${db.getUTCFullYear()}`;
}

/** Formate une date-heure à la française, ex. "5 avril à 14:32". */
export function quandFr(d: Date): string {
  return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Dimanche de Pâques (calendrier grégorien), algorithme de Gauss.
 * Ancre de tous les jours fériés mobiles belges.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexé
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Les dix jours fériés légaux belges d'une année, avec leur nom. */
export function belgianHolidays(year: number): Record<IsoDate, string> {
  const easter = easterSunday(year);
  const holidays: Record<IsoDate, string> = {};
  const set = (d: Date, name: string) => {
    holidays[toIsoDate(d)] = name;
  };
  set(new Date(Date.UTC(year, 0, 1)), "Nouvel An");
  set(addDays(easter, 1), "Lundi de Pâques");
  set(new Date(Date.UTC(year, 4, 1)), "Fête du travail");
  set(addDays(easter, 39), "Ascension");
  set(addDays(easter, 50), "Lundi de Pentecôte");
  set(new Date(Date.UTC(year, 6, 21)), "Fête nationale");
  set(new Date(Date.UTC(year, 7, 15)), "Assomption");
  set(new Date(Date.UTC(year, 10, 1)), "Toussaint");
  set(new Date(Date.UTC(year, 10, 11)), "Armistice");
  set(new Date(Date.UTC(year, 11, 25)), "Noël");
  return holidays;
}

/**
 * Jours fériés belges pour une plage d'années (bornes incluses), fusionnés
 * en une seule table. Utile pour couvrir un intervalle de dates qui chevauche
 * plusieurs années civiles (ex. le zoom seize semaines du Gantt à cheval sur
 * le nouvel an).
 */
export function belgianHolidaysRange(firstYear: number, lastYear: number): Record<IsoDate, string> {
  let all: Record<IsoDate, string> = {};
  for (let y = firstYear; y <= lastYear; y++) {
    all = { ...all, ...belgianHolidays(y) };
  }
  return all;
}

export function holidayName(d: Date, holidays: Record<IsoDate, string>): string | null {
  return holidays[toIsoDate(d)] ?? null;
}

export function isBusinessDay(d: Date, holidays: Record<IsoDate, string>): boolean {
  return !isWeekend(d) && holidayName(d, holidays) === null;
}
