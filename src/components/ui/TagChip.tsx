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
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        color: color ?? "#888780",
        backgroundColor: color ? `${color}1A` : "#E8E6E01A",
        border: selected ? `1px solid ${color ?? "#888780"}` : "1px solid transparent",
      }}
    >
      {label}
    </Tag>
  );
}
