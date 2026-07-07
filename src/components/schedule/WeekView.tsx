import { IconPaperclip } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { getHoliday } from "@/lib/holidays";
import type { Schedule } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function WeekView({
  weekDates,
  schedules,
}: {
  weekDates: string[];
  schedules: Schedule[];
}) {
  const byDate: Record<string, Schedule[]> = {};
  for (const date of weekDates) byDate[date] = [];
  for (const s of schedules) {
    if (byDate[s.date_start]) byDate[s.date_start].push(s);
  }

  return (
    <div className="flex flex-col gap-3">
      {weekDates.map((date, i) => {
        const daySchedules = byDate[date];
        const day = new Date(date).getDate();
        const holiday = getHoliday(date);
        return (
          <div key={date} className="rounded-2xl border border-border-light bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className={`text-[13px] font-medium ${holiday ? "text-terra" : "text-ink"}`}>
                {WEEKDAY_LABELS[i]} {day}
              </span>
              {holiday && <span className="text-[11px] text-terra">{holiday}</span>}
            </div>
            {daySchedules.length === 0 ? (
              <p className="text-[12px] text-stone">일정 없음</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {daySchedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                    />
                    <span
                      className={`truncate text-[13px] ${
                        s.is_important ? "font-medium text-terra" : "text-ink"
                      }`}
                    >
                      {s.title}
                    </span>
                    {s.time_start && (
                      <span className="shrink-0 text-[11px] text-stone">
                        {s.time_start.slice(0, 5)}
                      </span>
                    )}
                    {s.memo && (
                      <IconPaperclip size={12} className="shrink-0 text-stone" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
