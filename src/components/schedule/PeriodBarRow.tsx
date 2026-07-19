"use client";

import { getKeywordColor } from "@/lib/scheduleKeywords";
import { longRangeWithWeekday, shortRange } from "@/lib/scheduleFormat";
import type { ExpandedSchedule } from "@/lib/recurrence";

/** 기간 일정(여러 날짜에 걸친 일정) 요약 — [색 바] + 제목 + 범위. 월간 뷰의 데이 시트(하루
 * 상세)와 주간 뷰(주 최상단에 한 번만 나열) 양쪽이 공유한다.
 * - 기본(compact 아님): 제목/범위(요일 포함) 2줄 세로 배치 — 데이 시트용.
 * - compact: [바+제목 | 범위(짧은 형식)] 한 줄 배치 — 주간 뷰의 2단 그리드용. */
export function PeriodBarRow({
  schedule,
  onClick,
  compact = false,
}: {
  schedule: ExpandedSchedule;
  onClick: () => void;
  compact?: boolean;
}) {
  const color = getKeywordColor(schedule.keyword_main);

  if (compact) {
    return (
      <button onClick={onClick} className="flex min-w-0 items-center gap-2 text-left">
        <span className="h-3 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{schedule.title}</span>
        <span className="shrink-0 text-[12px] text-stone">{shortRange(schedule)}</span>
      </button>
    );
  }

  return (
    <button onClick={onClick} className="flex items-stretch gap-2 text-left">
      <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-ink">{schedule.title}</p>
        <p className="truncate text-[12px] text-stone">{longRangeWithWeekday(schedule)}</p>
      </div>
    </button>
  );
}
