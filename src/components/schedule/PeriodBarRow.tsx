"use client";

import { getKeywordColor } from "@/lib/scheduleKeywords";
import { longRangeWithWeekday } from "@/lib/scheduleFormat";
import type { ExpandedSchedule } from "@/lib/recurrence";

/** 기간 일정(여러 날짜에 걸친 일정) 한 줄 요약 — [색 바] + 제목 + 전체 범위(요일 포함).
 * 월간 뷰의 데이 시트(하루 상세)와 주간 뷰(주 최상단에 한 번만 나열) 양쪽이 공유한다. */
export function PeriodBarRow({
  schedule,
  onClick,
}: {
  schedule: ExpandedSchedule;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-stretch gap-2 text-left">
      <span
        className="w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: getKeywordColor(schedule.keyword_main) }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-ink">{schedule.title}</p>
        <p className="truncate text-[10px] text-stone">{longRangeWithWeekday(schedule)}</p>
      </div>
    </button>
  );
}
