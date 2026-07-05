import Link from "next/link";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import type { Schedule } from "@/types";

export function YearView({
  anchorDate,
  schedules,
}: {
  anchorDate: string;
  schedules: Schedule[];
}) {
  const year = new Date(anchorDate).getFullYear();

  const countByMonth: Record<number, number> = {};
  for (const s of schedules) {
    const m = new Date(s.date_start).getMonth();
    countByMonth[m] = (countByMonth[m] ?? 0) + 1;
  }

  const importantSchedules = schedules
    .filter((s) => s.is_important)
    .sort((a, b) => (a.date_start < b.date_start ? -1 : 1));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, m) => {
          const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
          const count = countByMonth[m] ?? 0;
          return (
            <Link
              key={m}
              href={`/schedule?view=month&date=${dateStr}`}
              className="flex flex-col items-center gap-1 rounded-2xl border border-border-light bg-white py-4"
            >
              <span className="text-[13px] font-medium text-ink">{m + 1}월</span>
              <span className="text-[11px] text-stone">
                {count > 0 ? `일정 ${count}건` : "-"}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-stone">연간 주요 일정</span>
        {importantSchedules.length === 0 && (
          <p className="text-[13px] text-stone">등록된 주요 일정이 없어요</p>
        )}
        {importantSchedules.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-2xl border border-border-light bg-white p-3"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
            />
            <span className="text-[12px] text-stone">{s.date_start}</span>
            <span className="truncate text-[14px] font-medium text-terra">{s.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
