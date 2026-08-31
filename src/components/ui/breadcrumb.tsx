import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="mb-1 flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={13} className="flex-shrink-0" aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-heading hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-muted">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
