"use client";

import { IconPlus, type TablerIcon } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";

export function SectionLabel({
  icon: Icon,
  children,
  onAdd,
  addLabel = "추가",
}: {
  icon: TablerIcon;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className={`flex items-center gap-1.5 ${mirror.label}`}>
        <Icon size={14} />
        <span>{children}</span>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label={addLabel}
          className={`flex h-11 w-11 items-center justify-center ${mirror.muted}`}
        >
          <IconPlus size={18} />
        </button>
      )}
    </div>
  );
}
