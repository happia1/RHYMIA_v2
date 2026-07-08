import Link from "next/link";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import type { Schedule } from "@/types";

export function YearView({
  anchorDate,
  schedules,
  membersById,
}: {
  anchorDate: string;
  schedules: Schedule[];
  membersById: Record<string, MemberInfo>;
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
      <div className="grid grid-cols-3 gap-y-4 text-center">
        {Array.from({ length: 12 }, (_, m) => {
          const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
          const count = countByMonth[m] ?? 0;
          return (
            <Link
              key={m}
              href={`/schedule?view=month&date=${dateStr}`}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[13px] font-medium text-ink">{m + 1}월</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {count > 0 ? `일정 ${count}건` : "-"}
              </span>
            </Link>
          );
        })}
      </div>

      <div className={`h-px w-full bg-border-light`} />

      <div className="flex flex-col">
        <span className="pb-2 text-[12px] font-medium text-[var(--text-muted)]">
          연간 주요 일정
        </span>
        {importantSchedules.length === 0 && (
          <p className="text-[13px] text-[var(--text-muted)]">등록된 주요 일정이 없어요</p>
        )}
        {importantSchedules.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 py-2.5 ${
              i > 0 ? "border-t border-border-light" : ""
            }`}
          >
            <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{s.date_start}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-terra">
              {s.title}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
              {targetLabel(s.target_members, membersById)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
