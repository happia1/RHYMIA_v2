"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconPaperclip, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { toDateStr, formatYearMonth, addMonths } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { solarToLunar } from "@/lib/lunar";
import { addDaysToDateStr, type ExpandedSchedule } from "@/lib/recurrence";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { ActivitySuggestionSection } from "@/components/schedule/ActivitySuggestionSection";
import { KeywordFilterRow } from "@/components/schedule/KeywordFilterRow";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { SectionExpand } from "@/components/ui/SectionExpand";
import { getLastYearHighlights } from "@/app/(main)/schedule/actions";
import { ACTIVITY_SUGGESTION_POOL, pickActivityCandidates } from "@/lib/activitySuggestions";
import { pickDeterministic } from "@/lib/randomPick";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 기간 밴드는 겹쳐도 최대 이 줄 수까지만 쌓는다 — 넘치면 그 일정은 도트로 폴백.
const MAX_BAND_ROWS = 2;

function scheduleOverlapsDay(s: ExpandedSchedule, date: string) {
  const end = s.date_end ?? s.date_start;
  return s.date_start <= date && date <= end;
}

function isPeriodSchedule(s: ExpandedSchedule) {
  return Boolean(s.date_end && s.date_end !== s.date_start);
}

function shortMD(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
}

function shortRange(s: ExpandedSchedule) {
  if (!isPeriodSchedule(s)) return shortMD(s.date_start);
  return `${shortMD(s.date_start)}–${shortMD(s.date_end!)}`;
}

export function MonthView({
  anchorDate,
  schedules,
  membersById,
  workspaceId,
  keywordMain,
  keywordSub,
  highlightId,
}: {
  anchorDate: string;
  schedules: ExpandedSchedule[];
  membersById: Record<string, MemberInfo>;
  workspaceId: string;
  keywordMain?: string;
  keywordSub?: string;
  /** 홈 "오늘 뭐하지"에서 특정 일정을 탭해 들어왔을 때 그 일정을 시각적으로 강조 */
  highlightId?: string;
}) {
  const [selectedDate, setSelectedDate] = useState(anchorDate);
  const [highlights, setHighlights] = useState<ExpandedSchedule[]>([]);
  const [prefillEvent, setPrefillEvent] = useState<ExpandedSchedule | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);

  const anchor = new Date(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const todayStr = toDateStr(new Date());
  const monthStart = toDateStr(new Date(year, month, 1));
  const monthEnd = toDateStr(new Date(year, month + 1, 0));

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

  // 기간 일정(date_start !== date_end, 반복 일정의 가상 인스턴스 포함 — schedules 자체가
  // getSchedulesForRange에서 이미 원본+가상 인스턴스를 합쳐서 내려온다)을 이 달 그리드 안에서
  // 겹치지 않게 최대 MAX_BAND_ROWS줄로 배정한다. 겹쳐서 못 들어가는 일정은 overflowIds에 담아
  // 도트로 폴백한다.
  const { bandsByDate, overflowIds, legend } = useMemo(() => {
    const candidates = schedules
      .filter(isPeriodSchedule)
      .map((s) => ({
        schedule: s,
        start: s.date_start < monthStart ? monthStart : s.date_start,
        end: s.date_end! > monthEnd ? monthEnd : s.date_end!,
      }))
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    const rowEnd: (string | null)[] = Array(MAX_BAND_ROWS).fill(null);
    const overflow = new Set<string>();
    const byDate: Record<string, { color: string; row: number }[]> = {};
    const placed: ExpandedSchedule[] = [];

    for (const cand of candidates) {
      let row = -1;
      for (let r = 0; r < MAX_BAND_ROWS; r++) {
        if (rowEnd[r] === null || cand.start > rowEnd[r]!) {
          row = r;
          break;
        }
      }
      if (row === -1) {
        overflow.add(cand.schedule.id);
        continue;
      }
      rowEnd[row] = cand.end;
      const color = getKeywordColor(cand.schedule.keyword_main);
      for (let d = cand.start; d <= cand.end; d = addDaysToDateStr(d, 1)) {
        (byDate[d] ??= []).push({ color, row });
      }
      placed.push(cand.schedule);
    }

    return { bandsByDate: byDate, overflowIds: overflow, legend: placed };
  }, [schedules, monthStart, monthEnd]);

  // 도트로 보여줄 일정 — 하루짜리 일정 전부 + 기간 일정 중 2줄에 못 들어간 것(걸치는 날마다).
  const dotsByDate = useMemo(() => {
    const map: Record<string, ExpandedSchedule[]> = {};
    for (const s of schedules) {
      const period = isPeriodSchedule(s);
      if (period && !overflowIds.has(s.id)) continue; // 밴드로 이미 표현됨
      const start = period ? (s.date_start < monthStart ? monthStart : s.date_start) : s.date_start;
      const end = period ? (s.date_end! > monthEnd ? monthEnd : s.date_end!) : s.date_start;
      for (let d = start; d <= end; d = addDaysToDateStr(d, 1)) {
        (map[d] ??= []).push(s);
      }
    }
    return map;
  }, [schedules, overflowIds, monthStart, monthEnd]);

  const selectedSchedules = useMemo(
    () => schedules.filter((s) => scheduleOverlapsDay(s, selectedDate)),
    [schedules, selectedDate]
  );
  const activitySuggestion = useMemo(
    () => pickDeterministic(ACTIVITY_SUGGESTION_POOL, selectedDate),
    [selectedDate]
  );
  const activityCandidates = useMemo(() => pickActivityCandidates(selectedDate), [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    getLastYearHighlights(workspaceId, year, month).then((result) => {
      if (!cancelled) setHighlights(result);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, year, month]);

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

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAY_LABELS.map((wd) => (
          <span key={wd} className="text-[11px] text-[var(--text-muted)]">
            {wd}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const dotSchedules = dotsByDate[date] ?? [];
          const cellBands = bandsByDate[date] ?? [];
          const grocery = dotSchedules.find((s) => s.is_grocery && s.amount);
          const isToday = date === todayStr;
          const isSelected = date === selectedDate;
          const holiday = getHoliday(date);

          const lunar = solarToLunar(new Date(`${date}T00:00:00.000Z`));
          const showLunar = Boolean(lunar && (date === monthStart || lunar.day === 1 || lunar.day === 15));

          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className="flex flex-col items-center gap-0.5 py-1"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] ${
                  isToday
                    ? "bg-honey/15 font-medium text-honey"
                    : isSelected
                    ? "font-medium text-honey ring-1 ring-honey/40"
                    : holiday
                    ? "font-medium text-terra"
                    : "text-ink"
                }`}
              >
                {Number(date.slice(-2))}
              </span>
              <span className="text-[8.5px] leading-none text-[var(--text-muted)]" style={{ minHeight: 9 }}>
                {showLunar && lunar ? `음 ${lunar.month}.${lunar.day}` : ""}
              </span>
              <div className="flex gap-0.5" style={{ minHeight: 6 }}>
                {dotSchedules.slice(0, 3).map((s) => (
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
              <span className="flex w-[80%] flex-col gap-[1.5px]">
                {Array.from({ length: MAX_BAND_ROWS }, (_, row) => {
                  const band = cellBands.find((b) => b.row === row);
                  return (
                    <span
                      key={row}
                      className="h-[2px] rounded-full"
                      style={{
                        backgroundColor: band ? band.color : "transparent",
                        opacity: band ? 0.55 : undefined,
                      }}
                    />
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border-light pt-3">
          {legend.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-stone">
              <span
                className="h-[2px] w-3 rounded-full"
                style={{ backgroundColor: getKeywordColor(s.keyword_main), opacity: 0.55 }}
              />
              {s.title} {shortRange(s)}
            </span>
          ))}
        </div>
      )}

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
        {selectedSchedules.length > 0 && (
          <SectionExpand
            items={selectedSchedules}
            previewCount={5}
            title={`${selectedDate} 일정`}
            renderItem={(s, i) => (
              <button
                key={s.id}
                onClick={() => setEditingSchedule(s)}
                className={`flex items-center gap-3 py-2.5 text-left ${
                  i > 0 ? "border-t border-border-light" : ""
                } ${s.id === highlightId ? "-mx-2 rounded-xl bg-honey/10 px-2" : ""}`}
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
              </button>
            )}
          />
        )}
      </div>

      {highlights.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border-light pt-3">
          <span className="text-[10px] tracking-[0.1em] text-[var(--text-muted)]">작년 이맘때</span>
          <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {highlights.map((h, i) => (
              <span key={h.id}>
                {i > 0 && " · "}
                <button
                  onClick={() => setPrefillEvent(h)}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  {h.title} {shortRange(h)}
                </button>
              </span>
            ))}
          </p>
        </div>
      )}

      <AddEventSheet
        open={!!prefillEvent || !!editingSchedule}
        onClose={() => {
          setPrefillEvent(null);
          setEditingSchedule(null);
        }}
        workspaceId={workspaceId}
        members={Object.entries(membersById).map(([id, m]) => ({ id, display_name: m.display_name }))}
        defaultDate={editingSchedule ? editingSchedule.date_start : ""}
        prefill={
          prefillEvent
            ? {
                title: prefillEvent.title,
                keywordMain: prefillEvent.keyword_main,
                keywordSub: prefillEvent.keyword_sub,
              }
            : null
        }
        existingSchedule={editingSchedule}
      />
    </div>
  );
}
