export function StatusBadge({ status }: { status: { name: string; fillHex: string; colorHex: string } }) {
  return (
    <span className="rounded-md px-2 py-0.5 text-2xs font-semibold" style={{ background: status.fillHex, color: status.colorHex }}>
      {status.name}
    </span>
  );
}
