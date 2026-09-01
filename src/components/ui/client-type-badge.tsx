import type { ClientType } from "@prisma/client";

// Bleu Clair / Rose Poudré — deux des couleurs de la charte, déjà les jetons
// --color-line / --color-alert-wash (voir globals.css), donc déjà adaptées
// au thème sombre sans rien à ajouter ici.
const BACKGROUND: Record<ClientType, string> = {
  INTERNAL: "var(--color-line)",
  EXTERNAL: "var(--color-alert-wash)",
};

const LABEL: Record<ClientType, string> = {
  INTERNAL: "Interne",
  EXTERNAL: "Externe",
};

export function ClientTypeBadge({ type, className = "" }: { type: ClientType; className?: string }) {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-2xs font-semibold text-ink-muted uppercase ${className}`}
      style={{ background: BACKGROUND[type] }}
    >
      {LABEL[type]}
    </span>
  );
}
