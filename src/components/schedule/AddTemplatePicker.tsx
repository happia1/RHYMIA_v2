"use client";

import {
  IconNotebook,
  IconRepeat,
  IconListCheck,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";

export type TemplateType = "diary" | "habit" | "todo" | "event";

const TEMPLATES: { key: TemplateType; label: string; icon: typeof IconNotebook }[] = [
  { key: "diary", label: "다이어리", icon: IconNotebook },
  { key: "habit", label: "습관", icon: IconRepeat },
  { key: "todo", label: "할 일", icon: IconListCheck },
  { key: "event", label: "일정", icon: IconCalendarEvent },
];

export function AddTemplatePicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: TemplateType) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <h2 className="text-[17px] font-medium text-ink">무엇을 등록할까요?</h2>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border-light bg-cream py-6"
            >
              <Icon size={26} className="text-ink" />
              <span className="text-[13px] font-medium text-ink">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
