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

      <div className="flex rounded-full border border-border-light bg-surface p-1">
        {VIEWS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/schedule?view=${key}&date=${anchorDate}`}
            className={`flex-1 rounded-full py-1.5 text-center text-[13px] font-medium ${
              view === key ? "bg-ink text-cream" : "text-stone"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
