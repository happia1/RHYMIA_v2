import Link from "next/link";

const VIEWS: { key: "month" | "week" | "year"; label: string }[] = [
  { key: "month", label: "월간" },
  { key: "week", label: "주간" },
  { key: "year", label: "연간" },
];

/** 뷰 전환(월간/주간/연간) 탭만 담당 — 상태 텍스트/내 루틴 링크는 RoutineTopWidget으로,
 * 월 네비게이션은 MonthView 안으로 옮겨서 중복 제거함. */
export function ScheduleTabs({
  anchorDate,
  view,
}: {
  anchorDate: string;
  view: "month" | "week" | "year";
}) {
  return (
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
  );
}
