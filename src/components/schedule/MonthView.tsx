"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconCheck } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { toDateStr, formatYearMonth, addMonths } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { solarToLunar } from "@/lib/lunar";
import { addDaysToDateStr, type ExpandedSchedule } from "@/lib/recurrence";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { isPeriodSchedule, shortRange } from "@/lib/scheduleFormat";
import { ActivitySuggestionSection } from "@/components/schedule/ActivitySuggestionSection";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import { KeywordLegend } from "@/components/schedule/KeywordLegend";
import { MemberFilterRow } from "@/components/schedule/MemberFilterRow";
import { SectionExpand } from "@/components/ui/SectionExpand";
import { getLastYearHighlights, toggleTodoDone } from "@/app/(main)/schedule/actions";
import { ACTIVITY_SUGGESTION_POOL, pickActivityCandidates } from "@/lib/activitySuggestions";
import { pickDeterministic } from "@/lib/randomPick";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 기간 밴드는 겹쳐도 최대 이 줄 수까지만 쌓는다 — 넘치면 그 일정은 도트로 폴백.
const MAX_BAND_ROWS = 2;

function scheduleOverlapsDay(s: ExpandedSchedule, date: string) {
  const end = s.date_end ?? s.date_start;
  return s.date_start <= date && date <= end;
}

// 완료 항목은 하단으로 — Array.sort는 안정 정렬이라 같은 is_done끼리는 원래 순서(등록순)를 유지한다.
function sortTodos(list: Todo[]) {
  return [...list].sort((a, b) => Number(a.is_done) - Number(b.is_done));
}

function TodoRow({ todo, onToggle }: { todo: Todo; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 py-1.5 text-left">
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
          todo.is_done ? "border-sage bg-sage" : "border-border-light"
        }`}
      >
        {todo.is_done && <IconCheck size={9} className="text-white" stroke={3} />}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-[12px] ${
          todo.is_done ? "text-[var(--text-muted)] line-through" : "text-ink"
        }`}
      >
        {todo.title}
      </span>
    </button>
  );
}

export function MonthView({
  anchorDate,
  schedules,
  membersById,
  workspaceId,
  highlightId,
  monthTodos,
  overdueTodos,
  members,
  target,
}: {
  anchorDate: string;
  schedules: ExpandedSchedule[];
  membersById: Record<string, MemberInfo>;
  workspaceId: string;
  /** 홈 "오늘 뭐하지"에서 특정 일정을 탭해 들어왔을 때 그 일정을 시각적으로 강조 */
  highlightId?: string;
  /** 이 달 범위 안, due_date 기준 할 일 — 선택일 패널에서 due_date === selectedDate로 필터링 */
  monthTodos: Todo[];
  /** 마감일이 지났는데 아직 완료 안 한 할 일 — 오늘 날짜를 볼 때만 "지난 할 일"로 함께 표시 */
  overdueTodos: Todo[];
  /** 월 이동 줄 오른쪽의 멤버 필터 드롭다운용 */
  members: { id: string; display_name: string; avatar_color: string }[];
  target: string;
}) {
  const [selectedDate, setSelectedDate] = useState(anchorDate);
  const [highlights, setHighlights] = useState<ExpandedSchedule[]>([]);
  const [prefillEvent, setPrefillEvent] = useState<ExpandedSchedule | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<ExpandedSchedule | null>(null);
  const [todos, setTodos] = useState(monthTodos);
  const [overdue, setOverdue] = useState(overdueTodos);

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
    const byDate: Record<string, { color: string; row: number; isStart: boolean; isEnd: boolean }[]> = {};
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
        (byDate[d] ??= []).push({ color, row, isStart: d === cand.start, isEnd: d === cand.end });
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
  const isSelectedToday = selectedDate === todayStr;
  const selectedTodos = useMemo(
    () => sortTodos(todos.filter((t) => t.due_date === selectedDate)),
    [todos, selectedDate]
  );
  const overdueSorted = useMemo(() => sortTodos(overdue), [overdue]);

  const handleToggleTodo = (todo: Todo) => {
    const next = !todo.is_done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    setOverdue((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    toggleTodoDone(todo.id, next).catch(() => {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
      setOverdue((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
    });
  };
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

  // 홈 "오늘 뭐하지"에서 특정 일정을 탭해 들어온 딥링크의 최종 착지 — 해당 일정의
  // 상세 팝업이 열린 상태로 보여준다.
  useEffect(() => {
    if (!highlightId) return;
    const match = schedules.find((s) => s.id === highlightId);
    if (match) setDetailSchedule(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <KeywordLegend />
        <div className="flex items-center gap-4">
          <Link href={`/schedule?view=month&date=${addMonths(anchorDate, -1)}`} aria-label="이전 달">
            <IconChevronLeft size={20} className="text-stone" />
          </Link>
          <span className="text-[15px] font-medium text-ink">{formatYearMonth(anchorDate)}</span>
          <Link href={`/schedule?view=month&date=${addMonths(anchorDate, 1)}`} aria-label="다음 달">
            <IconChevronRight size={20} className="text-stone" />
          </Link>
        </div>
        <MemberFilterRow members={members} target={target} />
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
              <div className="flex gap-1" style={{ minHeight: 6 }}>
                {dotSchedules.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className="h-[4px] w-[4px] rounded-full"
                    style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                  />
                ))}
              </div>
              {grocery && (
                <span className="text-[9px] text-[var(--text-muted)]">
                  {grocery.amount!.toLocaleString()}
                </span>
              )}
              <span className="flex w-full flex-col gap-[1.5px]">
                {Array.from({ length: MAX_BAND_ROWS }, (_, row) => {
                  const band = cellBands.find((b) => b.row === row);
                  return (
                    <span
                      key={row}
                      className={`h-[2px] ${band?.isStart ? "rounded-l-full" : ""} ${
                        band?.isEnd ? "rounded-r-full" : ""
                      }`}
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

      <div className="flex flex-col gap-3">
        {getHoliday(selectedDate) && (
          <p className="text-[12px] font-medium text-terra">{getHoliday(selectedDate)}</p>
        )}

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-2 flex flex-col">
            {selectedTodos.length === 0 && !(isSelectedToday && overdueSorted.length > 0) ? (
              <p className="py-2 text-[12px] text-[var(--text-muted)]">없음</p>
            ) : (
              <>
                {selectedTodos.map((t) => (
                  <TodoRow key={t.id} todo={t} onToggle={() => handleToggleTodo(t)} />
                ))}
                {isSelectedToday && overdueSorted.length > 0 && (
                  <>
                    <span className="pt-2 text-[10px] font-medium text-terra">
                      지난 할 일 {overdueSorted.length}개
                    </span>
                    {overdueSorted.map((t) => (
                      <TodoRow key={t.id} todo={t} onToggle={() => handleToggleTodo(t)} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          <div className="col-span-3 flex flex-col border-l border-border-light pl-3">
            {selectedSchedules.length === 0 ? (
              <p className="py-2 text-[12px] text-[var(--text-muted)]">없음</p>
            ) : (
              <SectionExpand
                items={selectedSchedules}
                pageSize={4}
                renderItem={(s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setDetailSchedule(s)}
                    className={`flex flex-col gap-0.5 py-2 text-left ${
                      i > 0 ? "border-t border-border-light" : ""
                    } ${s.id === highlightId ? "-mx-2 rounded-xl bg-honey/10 px-2" : ""}`}
                  >
                    <span
                      className={`truncate text-[13px] ${
                        s.is_important ? "font-medium text-terra" : "text-ink"
                      }`}
                    >
                      {s.title}
                    </span>
                    <span className="truncate text-[10px] text-stone">
                      {s.time_start ? s.time_start.slice(0, 5) : "종일"} ·{" "}
                      {targetLabel(s.target_members, membersById)}
                    </span>
                  </button>
                )}
              />
            )}
          </div>
        </div>

        {selectedSchedules.length === 0 && (
          <ActivitySuggestionSection
            workspaceId={workspaceId}
            selectedDate={selectedDate}
            suggestion={activitySuggestion}
            candidatePool={activityCandidates}
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

      <ScheduleDetailSheet
        schedule={detailSchedule}
        membersById={membersById}
        onClose={() => setDetailSchedule(null)}
        onEdit={(s) => {
          setDetailSchedule(null);
          setEditingSchedule(s);
        }}
      />
    </div>
  );
}
