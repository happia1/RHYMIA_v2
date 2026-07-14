"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { formatYearMonth, addMonths } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { addDaysToDateStr, type ExpandedSchedule } from "@/lib/recurrence";
import { type MemberInfo } from "@/lib/scheduleTargets";
import { isPeriodSchedule } from "@/lib/scheduleFormat";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import { DaySheet } from "@/components/schedule/DaySheet";
import { KeywordLegend } from "@/components/schedule/KeywordLegend";
import { MemberFilterRow } from "@/components/schedule/MemberFilterRow";
import { getLastYearHighlights, toggleTodoDone } from "@/app/(main)/schedule/actions";
import { ACTIVITY_SUGGESTION_POOL, pickActivityCandidates } from "@/lib/activitySuggestions";
import { pickDeterministic } from "@/lib/randomPick";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 기간 밴드는 겹쳐도 최대 이 줄 수까지만 쌓는다 — 넘치면 마지막 줄에 "+N"으로 뭉뚱그려 표기.
const MAX_BAND_ROWS = 2;
// 아래 상수들은 밴드 라인 자체의 실제 렌더 크기(h-[2px], gap-[1.5px])와 반드시 일치해야
// 라벨이 "라인 바로 위"에 정확히 앉는다 — 라인 스타일을 바꾸면 같이 바꿀 것.
const BAND_LINE_H = 2;
const BAND_LINE_GAP = 1.5;
// 라인과 라벨 사이 간격(요구사항: 2~3px).
const BAND_LABEL_GAP = 2.5;
// 8px 텍스트(leading-none) 한 줄의 대략적인 렌더 높이 — 실측과 정확히 같을 필요는 없고,
// 밴드가 2줄로 쌓였을 때 row1 라벨을 row0 라벨 위로 한 슬롯 더 띄우는 간격 계산에만 쓴다
// (두 밴드가 같은 날 나란히 시작해 라벨이 둘 다 뜨는 드문 경우에도 서로 겹치지 않도록).
const BAND_LABEL_H = 9;

type TodoSheetTarget = { mode: "add"; date: string } | { mode: "edit"; todo: Todo };

type BandEntry = {
  color: string;
  row: number;
  isStart: boolean;
  isEnd: boolean;
  title: string;
  spanCells: number;
};

function scheduleOverlapsDay(s: ExpandedSchedule, date: string) {
  const end = s.date_end ?? s.date_start;
  return s.date_start <= date && date <= end;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// year/month(0-indexed)/day를 바로 문자열로 조립한다 — `toDateStr(new Date(y, m, d))`처럼
// Date를 거쳐 toISOString()으로 변환하면, UTC보다 앞선 시간대(한국 등)에서는 로컬 자정이
// 전날 UTC로 밀려 날짜가 하루 당겨지는 버그가 있었다(예: 7월 1일 셀이 "30"으로 표시 —
// 전월 마지막 날짜가 첫 주에 나타나는 버그의 실제 원인). 이미 알고 있는 y/m/d 숫자에서
// 곧장 문자열을 만들면 그 변환 자체가 없어 안전하다.
function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// 월요일 시작 기준, 이 날짜가 속한 달력 그리드 주의 마지막 날짜(일요일)를 구한다 —
// 기간 밴드 시작 셀의 라벨 폭을 "그 주 안에서" 몇 칸까지 뻗을 수 있는지 계산할 때 씀.
function endOfGridWeek(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0=월 ... 6=일
  d.setUTCDate(d.getUTCDate() + (6 - dow));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function daysBetween(a: string, b: string) {
  const da = new Date(`${a}T00:00:00.000Z`).getTime();
  const db = new Date(`${b}T00:00:00.000Z`).getTime();
  return Math.round((db - da) / 86400000);
}

// 밴드 라벨의 세로 위치 — 줄 인덱스(row)만으로 고정 계산(그날 실제로 뭐가 있는지와 무관),
// 라인 컨테이너 바닥에서부터의 거리(px)로 반환해 `bottom`에 그대로 쓴다. row0 라벨은 전체
// 라인 묶음 바로 위(간격 BAND_LABEL_GAP)에 앉고, row1 라벨은 row0 라인 사이 1.5px짜리 틈에
// 끼워 넣는 대신(그러면 폭이 좁아 겹침) row0 라벨 자리 위로 한 슬롯 더 쌓아 올린다 — 두
// 밴드가 같은 날 나란히 시작해도 두 라벨이 서로 겹치지 않게. 어느 쪽이든 그날 실제로 밴드가
// row0/row1에 있는지와 무관하게 항상 같은 값이 나오는 고정 오프셋이다.
function bandLabelBottomPx(row: number) {
  const totalLinesH = MAX_BAND_ROWS * BAND_LINE_H + (MAX_BAND_ROWS - 1) * BAND_LINE_GAP;
  return totalLinesH + BAND_LABEL_GAP + row * (BAND_LABEL_H + BAND_LABEL_GAP);
}

// 완료 항목은 하단으로 — Array.sort는 안정 정렬이라 같은 is_done끼리는 원래 순서(등록순)를 유지한다.
function sortTodos(list: Todo[]) {
  return [...list].sort((a, b) => Number(a.is_done) - Number(b.is_done));
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
  /** 홈 "오늘 뭐하지"에서 특정 일정을 탭해 들어왔을 때 그 일정의 날짜로 데이 시트를 연 채 착지 */
  highlightId?: string;
  /** 이 달 범위 안, due_date 기준 할 일 — 데이 시트에서 due_date === selectedDate로 필터링 */
  monthTodos: Todo[];
  /** 마감일이 지났는데 아직 완료 안 한 할 일 — 오늘 날짜를 볼 때만 "지난 할 일"로 함께 표시 */
  overdueTodos: Todo[];
  /** 월 이동 줄 오른쪽의 멤버 필터 드롭다운용 */
  members: { id: string; display_name: string; avatar_color: string }[];
  target: string;
}) {
  const initialHighlightMatch = highlightId ? schedules.find((s) => s.id === highlightId) : undefined;
  const [selectedDate, setSelectedDate] = useState(initialHighlightMatch?.date_start ?? anchorDate);
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialHighlightMatch));
  const [highlights, setHighlights] = useState<ExpandedSchedule[]>([]);
  const [prefillEvent, setPrefillEvent] = useState<ExpandedSchedule | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<ExpandedSchedule | null>(null);
  const [addNewOpen, setAddNewOpen] = useState(false);
  const [todoSheetTarget, setTodoSheetTarget] = useState<TodoSheetTarget | null>(null);
  const [todos, setTodos] = useState(monthTodos);
  const [overdue, setOverdue] = useState(overdueTodos);

  const anchor = new Date(anchorDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const now = new Date();
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = ymd(year, month, 1);
  const monthEnd = ymd(year, month, new Date(year, month + 1, 0).getDate());

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const leading = (firstDay.getDay() + 6) % 7; // 월요일=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: (string | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(ymd(year, month, d));
    }
    return result;
  }, [year, month]);
  // 가용 높이를 주(행) 수로 나눠 화면을 꽉 채운다(요구사항: 세로 스크롤바 제거) — grid-template-rows
  // 를 이 값 기준 repeat(N, 1fr)로 줘서 브라우저가 알아서 남는 높이를 균등 분배하게 한다.
  const weekRows = Math.ceil(cells.length / 7);

  // 기간 일정(date_start !== date_end, 반복 일정의 가상 인스턴스 포함 — schedules 자체가
  // getSchedulesForRange에서 이미 원본+가상 인스턴스를 합쳐서 내려온다)을 이 달 그리드 안에서
  // 겹치지 않게 최대 MAX_BAND_ROWS줄로 배정한다. 다 못 들어가는(overflow) 일정은 더 이상
  // 도트로 폴백하지 않고, 그 일정이 걸치는 날짜마다 마지막 줄에 "+N"(그날의 overflow 건수)으로
  // 뭉뚱그려 표기한다 — 전체 목록은 데이 시트에서 확인 가능하므로 달력엔 개수만.
  const { bandsByDate, overflowCountByDate } = useMemo(() => {
    const candidates = schedules
      .filter(isPeriodSchedule)
      .map((s) => ({
        schedule: s,
        start: s.date_start < monthStart ? monthStart : s.date_start,
        end: s.date_end! > monthEnd ? monthEnd : s.date_end!,
      }))
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    const rowEnd: (string | null)[] = Array(MAX_BAND_ROWS).fill(null);
    const overflowCandidates: typeof candidates = [];
    const byDate: Record<string, BandEntry[]> = {};

    for (const cand of candidates) {
      let row = -1;
      for (let r = 0; r < MAX_BAND_ROWS; r++) {
        if (rowEnd[r] === null || cand.start > rowEnd[r]!) {
          row = r;
          break;
        }
      }
      if (row === -1) {
        overflowCandidates.push(cand);
        continue;
      }
      rowEnd[row] = cand.end;
      const color = getKeywordColor(cand.schedule.keyword_main);
      // 라벨은 시작 셀에서 그 주(일요일까지)가 끝나는 지점까지만 뻗는다 — 다음 주로
      // 넘어가는 칸은 그리드 상 다른 행이라 라벨을 이어 그릴 수 없기 때문.
      const weekEnd = endOfGridWeek(cand.start);
      const labelEnd = cand.end < weekEnd ? cand.end : weekEnd;
      const spanCells = daysBetween(cand.start, labelEnd) + 1;
      for (let d = cand.start; d <= cand.end; d = addDaysToDateStr(d, 1)) {
        (byDate[d] ??= []).push({
          color,
          row,
          isStart: d === cand.start,
          isEnd: d === cand.end,
          title: cand.schedule.title,
          spanCells,
        });
      }
    }

    const overflowCount: Record<string, number> = {};
    for (const cand of overflowCandidates) {
      for (let d = cand.start; d <= cand.end; d = addDaysToDateStr(d, 1)) {
        overflowCount[d] = (overflowCount[d] ?? 0) + 1;
      }
    }

    return { bandsByDate: byDate, overflowCountByDate: overflowCount };
  }, [schedules, monthStart, monthEnd]);

  // 도트는 하루짜리(기간이 아닌) 일정만 — 기간 일정은 이제 전부 밴드 쪽(놓였든 +N 초과분이든)
  // 에서만 표현하므로 여기서 완전히 제외한다(중복 표기 방지).
  const dotsByDate = useMemo(() => {
    const map: Record<string, ExpandedSchedule[]> = {};
    for (const s of schedules) {
      if (isPeriodSchedule(s)) continue;
      (map[s.date_start] ??= []).push(s);
    }
    return map;
  }, [schedules]);

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
  // 지난(마감 지난) 할 일은 별도 섹션 없이 오늘 체크리스트에 그냥 섞어 보여준다 —
  // 오늘이 아닌 다른 날짜를 보고 있을 땐 그 날짜 자신의 할 일만.
  const checklistItems = useMemo(
    () => (isSelectedToday ? sortTodos([...selectedTodos, ...overdueSorted]) : selectedTodos),
    [selectedTodos, overdueSorted, isSelectedToday]
  );
  // "작년 이맘때" — 지난달 전체 하이라이트(highlights, 달 단위로 조회) 중 선택일과
  // 일(day-of-month)이 같은 것만 시트 하단에 노출한다.
  const lastYearForSelectedDate = useMemo(
    () => highlights.filter((h) => h.date_start.slice(-2) === selectedDate.slice(-2)),
    [highlights, selectedDate]
  );

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

  // 추가/삭제처럼 목록 자체가 바뀌는 변경은 router.refresh()로 서버에서 새 monthTodos/
  // overdueTodos를 받아오는데, useState의 초기값은 최초 마운트 때만 쓰이므로 prop이 실제로
  // 바뀔 때마다 로컬 상태를 다시 맞춰준다(완료 토글처럼 목록 구성 자체는 안 바뀌는 변경은
  // 이미 로컬에서 낙관적으로 처리해 여기 영향 없음).
  useEffect(() => {
    setTodos(monthTodos);
  }, [monthTodos]);
  useEffect(() => {
    setOverdue(overdueTodos);
  }, [overdueTodos]);

  useEffect(() => {
    let cancelled = false;
    getLastYearHighlights(workspaceId, year, month).then((result) => {
      if (!cancelled) setHighlights(result);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, year, month]);

  // 홈 "오늘 뭐하지"에서 특정 일정을 탭해 들어온 딥링크의 최종 착지 — 해당 일정의 날짜로
  // 데이 시트가 열린 상태로 보여준다(초기 렌더는 위 useState 초기값에서 이미 반영, 이 효과는
  // highlightId가 마운트 후 바뀌는 경우를 대비).
  useEffect(() => {
    if (!highlightId) return;
    const match = schedules.find((s) => s.id === highlightId);
    if (match) {
      setSelectedDate(match.date_start);
      setSheetOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  const handleCalendarAreaTap = () => {
    if (sheetOpen) setSheetOpen(false);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-x-hidden pb-16">
      <div className="flex shrink-0 items-center justify-between">
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid shrink-0 grid-cols-7 pb-1 text-center">
          {WEEKDAY_LABELS.map((wd) => (
            <span key={wd} className="text-[11px] text-[var(--text-muted)]">
              {wd}
            </span>
          ))}
        </div>

        <div
          className="grid flex-1 grid-cols-7 gap-y-1 text-center"
          style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
          onClick={handleCalendarAreaTap}
        >
          {cells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const dotSchedules = dotsByDate[date] ?? [];
            const cellBands = bandsByDate[date] ?? [];
            const overflowCount = overflowCountByDate[date] ?? 0;
            const grocery = dotSchedules.find((s) => s.is_grocery && s.amount);
            const isToday = date === todayStr;
            const isSelected = sheetOpen && date === selectedDate;
            const holiday = getHoliday(date);
            const lastRow = MAX_BAND_ROWS - 1;

            return (
              <button
                key={date}
                onClick={(e) => {
                  e.stopPropagation();
                  if (date === selectedDate && sheetOpen) {
                    setSheetOpen(false);
                  } else {
                    setSelectedDate(date);
                    setSheetOpen(true);
                  }
                }}
                className={`flex flex-col items-center justify-center gap-0.5 ${sheetOpen ? "py-0.5" : "py-1"}`}
              >
                <span
                  className={`flex items-center justify-center rounded-full ${
                    sheetOpen ? "h-5 w-5 text-[11px]" : "h-6 w-6 text-[13px]"
                  } ${
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
                <div className="flex gap-1" style={{ minHeight: sheetOpen ? 5 : 6 }}>
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
                {/* 라인은 텍스트 유무와 무관하게 항상 같은 두께·같은 줄 순서로 렌더(레이어
                    분리) — 라벨(제목/+N)은 별도로 position:absolute 오버레이로 얹어서 이
                    컨테이너의 문서 흐름(높이 계산)에는 전혀 관여하지 않는다. 시트가 열려
                    달력이 압축된 상태에선 라벨을 아예 숨기고 라인만 남긴다(요구사항 5) —
                    압축 상태에서 텍스트까지 같이 구겨지며 깨져 보이는 문제를 피하기 위해서다. */}
                <span className="relative flex w-full flex-col gap-[1.5px]">
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
                  {!sheetOpen &&
                    Array.from({ length: MAX_BAND_ROWS }, (_, row) => {
                      if (row === lastRow && overflowCount > 0) {
                        return (
                          <span
                            key={`label-${row}`}
                            className="pointer-events-none absolute left-0 text-[8px] leading-none text-[var(--text-muted)]"
                            style={{ bottom: bandLabelBottomPx(row) }}
                          >
                            +{overflowCount}
                          </span>
                        );
                      }
                      const band = cellBands.find((b) => b.row === row);
                      if (!band?.isStart) return null;
                      return (
                        <span
                          key={`label-${row}`}
                          className="pointer-events-none absolute left-0 truncate text-[8px] leading-none"
                          style={{
                            bottom: bandLabelBottomPx(row),
                            width: `${band.spanCells * 100}%`,
                            color: band.color,
                            opacity: 0.55,
                          }}
                        >
                          {band.title}
                        </span>
                      );
                    })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <DaySheet
        open={sheetOpen}
        date={selectedDate}
        onClose={() => setSheetOpen(false)}
        schedules={selectedSchedules}
        membersById={membersById}
        highlightId={highlightId}
        onOpenSchedule={setDetailSchedule}
        onAddSchedule={() => setAddNewOpen(true)}
        todos={checklistItems}
        onToggleTodo={handleToggleTodo}
        onOpenTodoEdit={(t) => setTodoSheetTarget({ mode: "edit", todo: t })}
        onAddTodo={() => setTodoSheetTarget({ mode: "add", date: selectedDate })}
        lastYearHighlights={lastYearForSelectedDate}
        onOpenLastYear={setPrefillEvent}
        workspaceId={workspaceId}
        activitySuggestion={activitySuggestion}
        activityCandidates={activityCandidates}
      />

      <AddEventSheet
        open={!!prefillEvent || !!editingSchedule || addNewOpen}
        onClose={() => {
          setPrefillEvent(null);
          setEditingSchedule(null);
          setAddNewOpen(false);
        }}
        workspaceId={workspaceId}
        members={Object.entries(membersById).map(([id, m]) => ({ id, display_name: m.display_name }))}
        defaultDate={editingSchedule ? editingSchedule.date_start : addNewOpen ? selectedDate : ""}
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

      <TodoSheet
        open={!!todoSheetTarget}
        onClose={() => setTodoSheetTarget(null)}
        workspaceId={workspaceId}
        existingTodo={todoSheetTarget?.mode === "edit" ? todoSheetTarget.todo : null}
        defaultDueDate={todoSheetTarget?.mode === "add" ? todoSheetTarget.date : null}
      />
    </div>
  );
}
