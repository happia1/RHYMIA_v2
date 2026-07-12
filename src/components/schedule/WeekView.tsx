"use client";

import { useState } from "react";
import { IconPaperclip } from "@tabler/icons-react";
import { getHoliday } from "@/lib/holidays";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import type { ExpandedSchedule } from "@/lib/recurrence";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function WeekView({
  weekDates,
  schedules,
  membersById,
  workspaceId,
}: {
  weekDates: string[];
  schedules: ExpandedSchedule[];
  membersById: Record<string, MemberInfo>;
  workspaceId: string;
}) {
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<ExpandedSchedule | null>(null);

  const byDate: Record<string, ExpandedSchedule[]> = {};
  for (const date of weekDates) byDate[date] = [];
  for (const s of schedules) {
    if (byDate[s.date_start]) byDate[s.date_start].push(s);
  }

  return (
    <div className="flex flex-col">
      {weekDates.map((date, i) => {
        const daySchedules = byDate[date];
        const day = new Date(date).getDate();
        const holiday = getHoliday(date);
        return (
          <div
            key={date}
            className={`flex flex-col gap-2 py-3 ${i > 0 ? "border-t border-border-light" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[13px] font-medium ${holiday ? "text-terra" : "text-ink"}`}
              >
                {WEEKDAY_LABELS[i]} {day}
              </span>
              {holiday && <span className="text-[11px] text-terra">{holiday}</span>}
            </div>
            {daySchedules.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)]">일정 없음</p>
            ) : (
              <div className="flex flex-col gap-row pl-section-indent">
                {daySchedules.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDetailSchedule(s)}
                    className="flex items-center gap-3 text-left"
                  >
                    <span
                      className="w-12 shrink-0 text-[13px] text-honey"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {s.time_start ? s.time_start.slice(0, 5) : "종일"}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        s.is_important ? "font-medium text-terra" : "text-ink"
                      }`}
                    >
                      {s.title}
                    </span>
                    {s.memo && (
                      <IconPaperclip size={12} className="shrink-0 text-[var(--text-muted)]" />
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
                      {targetLabel(s.target_members, membersById)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <AddEventSheet
        open={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        workspaceId={workspaceId}
        members={Object.entries(membersById).map(([id, m]) => ({ id, display_name: m.display_name }))}
        defaultDate={editingSchedule?.date_start ?? weekDates[0]}
        existingSchedule={editingSchedule}
      />

      <ScheduleDetailSheet
        schedule={detailSchedule}
        membersById={membersById}
        onClose={() => setDetailSchedule(null)}
        onEdit={(s) => {
          setDetailSchedule(null);
          setEditingSchedule(s);
        }}
      />
    </div>
  );
}
