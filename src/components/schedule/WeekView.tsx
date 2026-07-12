"use client";

import { useState } from "react";
import { getHoliday } from "@/lib/holidays";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import type { ExpandedSchedule } from "@/lib/recurrence";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** 요일·일자를 왼쪽 고정 폭 칼럼에 두고, 그 날의 일정들을 오른쪽에 "제목 시간·대상" 한 줄
 * 형식으로 쌓는다 — 요일 라벨은 한 번만 보이고 일정이 여러 개면 그 옆으로 줄바꿈만
 * 누적된다. 텍스트를 전반적으로 축소해 한 주(7일) 전체가 스크롤 없이 한 화면에 들어오게
 * 한다. 일정이 없는 날은 요일만 흐리게 표시(별도 "일정 없음" 문구 없음). */
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
        const weekdayColor = holiday
          ? "text-terra"
          : daySchedules.length === 0
          ? "text-[var(--text-muted)]"
          : "text-ink";
        return (
          <div
            key={date}
            className={`flex gap-2 py-1.5 ${i > 0 ? "border-t border-border-light" : ""}`}
          >
            <span className={`w-9 shrink-0 pt-px text-[11px] font-medium ${weekdayColor}`}>
              {WEEKDAY_LABELS[i]} {day}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {daySchedules.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setDetailSchedule(s)}
                  className="flex min-w-0 items-baseline gap-1.5 text-left"
                >
                  <span
                    className={`min-w-0 truncate text-[12px] ${
                      s.is_important ? "font-medium text-terra" : "text-ink"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="shrink-0 truncate text-[10px] text-stone">
                    {s.time_start ? s.time_start.slice(0, 5) : "종일"} ·{" "}
                    {targetLabel(s.target_members, membersById)}
                  </span>
                </button>
              ))}
            </div>
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
