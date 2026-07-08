import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { formatYearMonth, addMonths } from "@/lib/date";

const VIEWS: { key: "month" | "week" | "year"; label: string }[] = [
  { key: "month", label: "월간" },
  { key: "week", label: "주간" },
  { key: "year", label: "연간" },
];

export function ScheduleTabs({
  anchorDate,
  view,
  myStatusText,
}: {
  anchorDate: string;
  view: "month" | "week" | "year";
  myStatusText: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-ink">{myStatusText}</span>
        <Link href="/schedule/routine" className="text-[13px] font-medium text-ocean">
          내 루틴
        </Link>
      </div>

      {view === "month" && (
        <div className="flex items-center justify-center gap-4">
          <Link href={`/schedule?view=month&date=${addMonths(anchorDate, -1)}`} aria-label="이전 달">
            <IconChevronLeft size={20} className="text-stone" />
          </Link>
          <span className="text-[15px] font-medium text-ink">{formatYearMonth(anchorDate)}</span>
          <Link href={`/schedule?view=month&date=${addMonths(anchorDate, 1)}`} aria-label="다음 달">
            <IconChevronRight size={20} className="text-stone" />
          </Link>
        </div>
      )}

      <div className="flex gap-4 border-b border-border-light">
        {VIEWS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/schedule?view=${key}&date=${anchorDate}`}
            className={`border-b-2 pb-2 text-[13px] font-medium ${
              view === key
                ? "border-ink text-ink"
                : "border-transparent text-[var(--text-muted)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
