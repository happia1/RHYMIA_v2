"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconPaperclip, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { toDateStr, formatYearMonth, addMonths } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { ActivitySuggestionSection } from "@/components/schedule/ActivitySuggestionSection";
import { KeywordFilterRow } from "@/components/schedule/KeywordFilterRow";
import { ACTIVITY_SUGGESTION_POOL, pickActivityCandidates } from "@/lib/activitySuggestions";
import { pickDeterministic } from "@/lib/randomPick";
import type { Schedule } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function MonthView({
  anchorDate,
  schedules,
  membersById,
  workspaceId,
  keywordMain,
  keywordSub,
}: {
  anchorDate: string;
  schedules: Schedule[];
  membersById: Record<string, MemberInfo>;
  workspaceId: string;
  keywordMain?: string;
  keywordSub?: string;
}) {
  const [selectedDate, setSelectedDate] = useState(anchorDate);

  const anchor = new Date(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const todayStr = toDateStr(new Date());

  const byDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    for (const s of schedules) {
      (map[s.date_start] ??= []).push(s);
    }
    return map;
  }, [schedules]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const leading = (firstDay.getDay() + 6) % 7; // 월요일=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(toDateStr(new Date(year, month, d)));
    }
    return result;
  }, [year, month]);

  const selectedSchedules = byDate[selectedDate] ?? [];
  const activitySuggestion = useMemo(
    () => pickDeterministic(ACTIVITY_SUGGESTION_POOL, selectedDate),
    [selectedDate]
  );
  const activityCandidates = useMemo(() => pickActivityCandidates(selectedDate), [selectedDate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-4">
        <Link href={`/schedule?view=month&date=${addMonths(anchorDate, -1)}`} aria-label="이전 달">
          <IconChevronLeft size={20} className="text-stone" />
        </Link>
        <span className="text-[15px] font-medium text-ink">{formatYearMonth(anchorDate)}</span>
        <Link href={`/schedule?view=month&date=${addMonths(anchorDate, 1)}`} aria-label="다음 달">
          <IconChevronRight size={20} className="text-stone" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="text-[11px] text-[var(--text-muted)]">
            {label}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const daySchedules = byDate[date] ?? [];
          const grocery = daySchedules.find((s) => s.is_grocery && s.amount);
          const isToday = date === todayStr;
          const isSelected = date === selectedDate;
          const holiday = getHoliday(date);
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 ${
                isToday ? "bg-honey/15" : isSelected ? "ring-1 ring-honey/40" : ""
              }`}
            >
              <span
                className={`text-[13px] ${
                  isToday
                    ? "font-medium text-honey"
                    : holiday
                    ? "font-medium text-terra"
                    : "text-ink"
                }`}
              >
                {Number(date.slice(-2))}
              </span>
              <div className="flex gap-0.5">
                {daySchedules.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                  />
                ))}
              </div>
              {grocery && (
                <span className="text-[9px] text-[var(--text-muted)]">
                  {grocery.amount!.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={`h-px w-full bg-border-light`} />

      <KeywordFilterRow keywordMain={keywordMain} keywordSub={keywordSub} />

      <div className="flex flex-col">
        {getHoliday(selectedDate) && (
          <p className="pb-2 text-[12px] font-medium text-terra">{getHoliday(selectedDate)}</p>
        )}
        {selectedSchedules.length === 0 && (
          <>
            <p className="py-4 text-center text-[13px] text-[var(--text-muted)]">일정이 없어요</p>
            <ActivitySuggestionSection
              workspaceId={workspaceId}
              selectedDate={selectedDate}
              suggestion={activitySuggestion}
              candidatePool={activityCandidates}
            />
          </>
        )}
        {selectedSchedules.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 py-2.5 ${
              i > 0 ? "border-t border-border-light" : ""
            }`}
          >
            <span
              className="w-12 shrink-0 text-[13px] text-honey"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {s.time_start ? s.time_start.slice(0, 5) : "종일"}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-[14px] ${
                s.is_important ? "font-medium text-terra" : "text-ink"
              }`}
            >
              {s.title}
            </span>
            {s.memo && <IconPaperclip size={12} className="shrink-0 text-[var(--text-muted)]" />}
            <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
              {targetLabel(s.target_members, membersById)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
