export function TagChip({
  label,
  color,
  selected = false,
  onClick,
}: {
  label: string;
  color?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`text-[12px] font-medium ${selected ? "" : "text-[var(--text-muted)]"}`}
      style={selected ? { color: color ?? "var(--text-primary)" } : undefined}
    >
      {label}
    </Tag>
  );
}
