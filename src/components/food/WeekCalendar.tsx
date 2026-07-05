import Link from "next/link";

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
  return (
    <div className="grid grid-cols-7 gap-1 rounded-2xl border border-border-light bg-white p-3">
      {weekDates.map((date, i) => {
        const day = new Date(date).getDate();
        const active = date === selectedDate;
        return (
          <Link
            key={date}
            href={`/food?date=${date}`}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 ${
              active ? "bg-honey/15" : ""
            }`}
          >
            <span className="text-[10px] text-stone">{WEEKDAY_LABELS[i]}</span>
            <span
              className={`text-[13px] font-medium ${active ? "text-honey" : "text-ink"}`}
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
  );
}
