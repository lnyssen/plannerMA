import { UserRound } from "lucide-react";

const SIZE = {
  sm: { box: "h-5 w-5 text-[0.625rem]", icon: 11 },
  md: { box: "h-7 w-7 text-2xs", icon: 14 },
} as const;

/**
 * Teinte dérivée du nom, stable d'un écran à l'autre.
 *
 * Un simple hash sur les points de code : deux personnes différentes
 * tombent rarement sur la même teinte, et surtout la même personne garde
 * toujours la sienne — c'est ce qui permet de repérer « qui fait quoi »
 * dans une liste sans lire les noms. Les clartés sont fixées en CSS par
 * thème (voir .person-avatar dans globals.css), pas ici.
 */
function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.codePointAt(i)!) % 360;
  return h;
}

/** « Amélie Verstraeten » → « AV » ; « Chloé » → « C ». */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Pastille d'identité d'une personne.
 *
 * Les listes, le Kanban et le planning n'affichaient que « Non attribué »
 * ou un nom en gris : rien ne permettait de repérer d'un coup d'œil à qui
 * revient quoi. Une pastille colorée et stable se lit avant le texte.
 */
export function PersonAvatar({
  name,
  size = "sm",
  className = "",
}: {
  /** `null` pour une tâche non attribuée — pastille neutre, pas de fausse identité. */
  name: string | null;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];
  const base = `flex flex-shrink-0 items-center justify-center rounded-full font-bold ${s.box} ${className}`;

  if (!name) {
    return (
      <span
        aria-hidden="true"
        title="Non attribué"
        className={`${base} border border-dashed border-line text-ink-muted`}
      >
        <UserRound size={s.icon} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      title={name}
      className={`person-avatar ${base}`}
      style={{ ["--avatar-h" as string]: hueOf(name) }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Pastille + nom, pour les cellules et cartes où le nom reste nécessaire. */
export function PersonLabel({
  name,
  size = "sm",
  emptyLabel = "Non attribué",
}: {
  name: string | null;
  size?: keyof typeof SIZE;
  emptyLabel?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <PersonAvatar name={name} size={size} />
      <span className={`truncate ${name ? "text-ink" : "text-ink-muted"}`}>{name ?? emptyLabel}</span>
    </span>
  );
}
