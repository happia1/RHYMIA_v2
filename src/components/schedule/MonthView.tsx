"use client";

import { useMemo, useState } from "react";
import { IconPaperclip } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { toDateStr } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import type { Schedule } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function MonthView({
  anchorDate,
  schedules,
}: {
  anchorDate: string;
  schedules: Schedule[];
}) {
  const [selectedDate, setSelectedDate] = useState(anchorDate);

  const anchor = new Date(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const byDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    for (const s of schedules) {
      (map[s.date_start] ??= []).push(s);
    }
    return map;
  }, [schedules]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const leading = (firstDay.getDay() + 6) % 7; // 월요일=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(toDateStr(new Date(year, month, d)));
    }
    return result;
  }, [year, month]);

  const selectedSchedules = byDate[selectedDate] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border-light bg-white p-3">
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="text-[11px] text-stone">
              {label}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const daySchedules = byDate[date] ?? [];
            const grocery = daySchedules.find((s) => s.is_grocery && s.amount);
            const active = date === selectedDate;
            const holiday = getHoliday(date);
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${
                  active ? "bg-honey/15" : ""
                }`}
              >
                <span
                  className={`text-[13px] ${
                    active ? "font-medium text-honey" : holiday ? "font-medium text-terra" : "text-ink"
                  }`}
                >
                  {Number(date.slice(-2))}
                </span>
                <div className="flex gap-0.5">
                  {daySchedules.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                    />
                  ))}
                </div>
                {grocery && (
                  <span className="text-[9px] text-stone">{grocery.amount!.toLocaleString()}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {getHoliday(selectedDate) && (
          <p className="px-1 text-[12px] font-medium text-terra">{getHoliday(selectedDate)}</p>
        )}
        {selectedSchedules.length === 0 && (
          <p className="py-4 text-center text-[13px] text-stone">일정이 없어요</p>
        )}
        {selectedSchedules.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-2xl border border-border-light bg-white p-3"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
            />
            <span
              className={`flex-1 truncate text-[14px] ${
                s.is_important ? "font-medium text-terra" : "text-ink"
              }`}
            >
              {s.title}
            </span>
            {s.time_start && (
              <span className="text-[12px] text-stone">{s.time_start.slice(0, 5)}</span>
            )}
            {s.memo && <IconPaperclip size={14} className="text-stone" />}
          </div>
        ))}
      </div>
    </div>
  );
}
