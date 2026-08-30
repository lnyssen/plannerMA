import type { TaskStatus } from "@prisma/client";
import { STATUS_COLORS, STATUS_LABEL } from "@/lib/planning/status";

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { fill, text } = STATUS_COLORS[status];
  return (
    <span className="px-2 py-0.5 text-2xs font-semibold" style={{ background: fill, color: text }}>
      {STATUS_LABEL[status]}
    </span>
  );
}
