function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2);
}

export function Avatar({
  name,
  color = "#E1F5EE",
  textColor = "#0F6E56",
  imageUrl,
  size = 32,
}: {
  name: string;
  color?: string;
  textColor?: string;
  imageUrl?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: textColor,
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}
