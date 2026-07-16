import type { Schedule } from "@/types";

type DateRange = Pick<Schedule, "date_start" | "date_end">;

export function isPeriodSchedule(s: DateRange) {
  return Boolean(s.date_end && s.date_end !== s.date_start);
}

function shortMD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
}

export function shortRange(s: DateRange) {
  if (!isPeriodSchedule(s)) return shortMD(s.date_start);
  return `${shortMD(s.date_start)}–${shortMD(s.date_end!)}`;
}

const RANGE_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function longMDWeekday(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const wd = RANGE_WEEKDAY_LABELS[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}. ${d.getUTCDate()}.(${wd})`;
}

/** 기간 일정을 "7. 22.(수) - 8. 14.(금)" 형식으로 — 데이 시트/주간 뷰의 기간 표시(세로 막대 +
 * 아래 작은 폰트 줄)에서 공용으로 쓴다. `shortRange`보다 더 상세한(요일 포함) 표기가
 * 필요할 때 전용. */
export function longRangeWithWeekday(s: DateRange) {
  if (!isPeriodSchedule(s)) return longMDWeekday(s.date_start);
  return `${longMDWeekday(s.date_start)} - ${longMDWeekday(s.date_end!)}`;
}
