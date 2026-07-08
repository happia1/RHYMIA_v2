import type { TablerIcon } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";

export function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: TablerIcon;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${mirror.label}`}>
      <Icon size={14} />
      <span>{children}</span>
    </div>
  );
}
