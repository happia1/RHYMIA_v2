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
