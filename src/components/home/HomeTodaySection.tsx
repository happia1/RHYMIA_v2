"use client";

import { useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { TodayEvents } from "@/components/home/TodayEvents";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import { AddTemplatePicker, type TemplateType } from "@/components/schedule/AddTemplatePicker";
import type { Schedule, Todo } from "@/types";

export function HomeTodaySection({
  todaySchedules,
  todayTodos,
  overdueTodos,
  members,
  workspaceId,
  defaultDate,
}: {
  todaySchedules: Schedule[];
  todayTodos: Todo[];
  overdueTodos: Todo[];
  members: { id: string; display_name: string }[];
  workspaceId: string;
  defaultDate: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<TemplateType | null>(null);

  const handleSelect = (type: TemplateType) => {
    setPickerOpen(false);
    setActiveSheet(type);
  };

  return (
    <section className="flex flex-col gap-1.5">
      <SectionLabel icon={<IconCalendar size={14} />} onAdd={() => setPickerOpen(true)} addLabel="일정 등록">
        오늘 뭐하지
      </SectionLabel>
      <div className="pl-section-indent">
        <TodayEvents
          todaySchedules={todaySchedules}
          todayTodos={todayTodos}
          overdueTodos={overdueTodos}
        />
      </div>

      <AddTemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelect} />

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
    </section>
  );
}
