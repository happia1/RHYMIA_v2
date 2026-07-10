import Link from "next/link";
import { toDateStr } from "@/lib/date";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function WeekCalendar({
  weekDates,
  selectedDate,
  datesWithMeals,
}: {
  weekDates: string[];
  selectedDate: string;
  datesWithMeals: Set<string>;
}) {
  const todayStr = toDateStr(new Date());

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date, i) => {
          const day = new Date(date).getDate();
          const isToday = date === todayStr;
          const isSelected = date === selectedDate;
          return (
            <Link
              key={date}
              href={`/food?date=${date}`}
              className={`flex flex-col items-center gap-1 rounded-full py-1.5 ${
                isToday ? "bg-honey/15" : isSelected ? "ring-1 ring-honey/40" : ""
              }`}
            >
              <span className="text-[10px] text-[var(--text-muted)]">{WEEKDAY_LABELS[i]}</span>
              <span
                className={`text-[13px] font-medium ${isToday ? "text-honey" : "text-ink"}`}
              >
                {day}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  datesWithMeals.has(date) ? "bg-honey" : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </div>
      <div className="h-px w-full bg-border-light" />
    </div>
  );
}
