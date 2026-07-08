"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { AddTemplatePicker, type TemplateType } from "@/components/schedule/AddTemplatePicker";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { DiarySheet } from "@/components/schedule/DiarySheet";
import { HabitSheet } from "@/components/schedule/HabitSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import type { WeatherData } from "@/lib/weather";

interface MemberOption {
  user_id: string;
  display_name: string;
}

export function AddEventEntry({
  workspaceId,
  members,
  defaultDate,
  autoOpen,
  weather,
}: {
  workspaceId: string;
  members: MemberOption[];
  defaultDate: string;
  autoOpen: boolean;
  weather: WeatherData | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(autoOpen);
  const [activeSheet, setActiveSheet] = useState<TemplateType | null>(null);

  useEffect(() => {
    if (autoOpen) setPickerOpen(true);
  }, [autoOpen]);

  const handleSelect = (type: TemplateType) => {
    setPickerOpen(false);
    setActiveSheet(type);
  };

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        className="fixed bottom-[84px] right-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream"
        aria-label="등록하기"
      >
        <IconPlus size={26} />
      </button>

      <AddTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />

      <DiarySheet
        open={activeSheet === "diary"}
        onClose={() => setActiveSheet(null)}
        workspaceId={workspaceId}
        defaultDate={defaultDate}
        weather={weather}
      />
      <HabitSheet open={activeSheet === "habit"} onClose={() => setActiveSheet(null)} />
      <TodoSheet
        open={activeSheet === "todo"}
        onClose={() => setActiveSheet(null)}
        workspaceId={workspaceId}
      />
      <AddEventSheet
        open={activeSheet === "event"}
        onClose={() => setActiveSheet(null)}
        workspaceId={workspaceId}
        members={members}
        defaultDate={defaultDate}
      />
    </>
  );
}
