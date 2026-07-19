import Link from "next/link";

const VIEWS: { key: "day" | "month" | "week" | "year"; label: string }[] = [
  { key: "day", label: "하루" },
  { key: "month", label: "월간" },
  { key: "week", label: "주간" },
  { key: "year", label: "연간" },
];

/** 뷰 전환(하루/월간/주간/연간) 탭만 담당. "하루"는 2026-07-12부터 신설 —
 * 예전 /schedule/routine 페이지(RoutineEditor)를 흡수한 자리로, 루틴 도넛+블록 편집을
 * 여기서 한다. 월 네비게이션은 MonthView 안으로 옮겨서 중복 제거함. */
export function ScheduleTabs({
  anchorDate,
  view,
}: {
  anchorDate: string;
  view: "day" | "month" | "week" | "year";
}) {
  return (
    <div className="flex gap-4 border-b border-border-light">
      {VIEWS.map(({ key, label }) => (
        <Link
          key={key}
          href={`/schedule?view=${key}&date=${anchorDate}`}
          className={`border-b-2 pb-2 text-[16px] font-medium ${
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
