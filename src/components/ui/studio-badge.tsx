export function StudioBadge({ name, fillHex, colorHex }: { name: string; fillHex: string; colorHex: string }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-2xs font-semibold"
      style={{ background: fillHex, color: colorHex }}
    >
      {name}
    </span>
  );
}
