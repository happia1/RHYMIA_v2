"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { formatYearMonth, addMonths } from "@/lib/date";
import { useSwipeCalendarNav, swipeCalendarNavStyle } from "@/components/schedule/useSwipeCalendarNav";
import {
  MonthCalendarGrid,
  MAX_BAND_ROWS,
  dowOf,
  type BandEntry,
  type LabelOccurrence,
} from "@/components/schedule/MonthCalendarGrid";
import { addDaysToDateStr, type ExpandedSchedule } from "@/lib/recurrence";
import { type MemberInfo } from "@/lib/scheduleTargets";
import { isPeriodSchedule } from "@/lib/scheduleFormat";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import { DaySheet } from "@/components/schedule/DaySheet";
import { DaySheetContent } from "@/components/schedule/DaySheetContent";
import { KeywordLegend } from "@/components/schedule/KeywordLegend";
import { MemberFilterRow } from "@/components/schedule/MemberFilterRow";
import { getLastYearHighlights, toggleTodoDone } from "@/app/(main)/schedule/actions";
import { ACTIVITY_SUGGESTION_POOL, pickActivityCandidates } from "@/lib/activitySuggestions";
import { pickDeterministic } from "@/lib/randomPick";
import { useDeviceLayout } from "@/lib/useDeviceLayout";
import type { Todo } from "@/types";

// 달력 ↔ 데이 시트 전환 애니메이션 지속시간 — DaySheet(useSwipeDownToClose 기반 슬라이드)와
// 같은 값을 써서 "압축"과 "시트 등장"이 같은 박자로 움직이게 한다.
const COMPRESS_TRANSITION = "height 200ms cubic-bezier(0.4, 0, 0.2, 1)";

type TodoSheetTarget = { mode: "add"; date: string } | { mode: "edit"; todo: Todo };

function scheduleOverlapsDay(s: ExpandedSchedule, date: string) {
  const end = s.date_end ?? s.date_start;
  return s.date_start <= date && date <= end;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// year/month(0-indexed)/day를 바로 문자열로 조립한다 — `toDateStr(new Date(y, m, d))`처럼
// Date를 거쳐 toISOString()으로 변환하면, UTC보다 앞선 시간대(한국 등)에서는 로컬 자정이
// 전날 UTC로 밀려 날짜가 하루 당겨지는 버그가 있었다. 이미 알고 있는 y/m/d 숫자에서 곧장
// 문자열을 만들면 그 변환 자체가 없어 안전하다.
function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function isMonday(dateStr: string) {
  return dowOf(dateStr) === 1;
}

// 월요일 시작 기준, 이 날짜가 속한 달력 그리드 주의 마지막 날짜(일요일)를 구한다.
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
  const router = useRouter();
  const { layout } = useDeviceLayout();
  const initialHighlightMatch = highlightId ? schedules.find((s) => s.id === highlightId) : undefined;
  const [selectedDate, setSelectedDate] = useState(initialHighlightMatch?.date_start ?? anchorDate);
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialHighlightMatch));
  // 태블릿 우측 패널 전용 — 아직 아무 날짜도 직접 고르지 않은 기본 상태인지(오늘 표시)
  // 추적한다. 딥링크로 특정 일정을 갖고 들어온 경우는 이미 "선택된" 상태로 취급.
  const [hasManualSelection, setHasManualSelection] = useState(Boolean(initialHighlightMatch));
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
  // 가용 높이를 주(행) 수로 나눠 화면을 꽉 채운다 — grid-template-rows를 이 값 기준
  // repeat(N, 1fr)로 줘서 브라우저가 알아서 남는 높이를 균등 분배하게 한다.
  const weekRows = Math.ceil(cells.length / 7);

  // 기간 일정(date_start !== date_end, 반복 일정의 가상 인스턴스 포함)의 레인(층) 배정.
  // 규칙(요구사항 4):
  //  1) 서로 겹치는(체인으로 연결된) 기간들을 그룹으로 묶는다 — 시작일 순 스윕으로 병합.
  //  2) 그룹 안에서 기간이 긴 순(동률이면 시작일 빠른 순)으로 정렬해, 긴 것부터 레인 0(맨
  //     아래)부터 그리디 배정 — 이미 그 레인에 있는 것과 날짜가 겹치면 다음 레인으로.
  //  3) 레인은 해당 기간의 전체 표시 구간(월 범위로 클램프된) 단위로 "한 번에" 배정되고
  //     그 값 그대로 쓰이므로, 주가 바뀌어도(그리드 행이 바뀌어도) 재배정되지 않는다 —
  //     이전엔 이걸 "이번 주 안에서만" 매번 다시 계산해 같은 일정이 주마다 층을 옮기는
  //     문제가 있었음.
  //  4) MAX_BAND_ROWS를 넘는 항목은 라인 자리가 없다(overflow) — 그래도 이름은 잃지 않고
  //     라벨 텍스트(occurrence)에는 계속 포함된다.
  // 라벨 표기 시점(요구사항 6): 기간 시작일 + 그 기간이 이어지는 각 주의 첫 셀(월요일).
  const { bandsByDate, labelsByDate } = useMemo(() => {
    const candidates = schedules
      .filter(isPeriodSchedule)
      .map((s) => {
        const start = s.date_start < monthStart ? monthStart : s.date_start;
        const end = s.date_end! > monthEnd ? monthEnd : s.date_end!;
        return { schedule: s, start, end, duration: daysBetween(start, end) };
      })
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

    type Cand = (typeof candidates)[number];

    // 겹치는(체인으로 연결된) 기간들을 그룹으로 묶는다 — 시작일 순으로 훑으며 현재 그룹의
    // 최대 끝일보다 늦게 시작하면 새 그룹.
    const groups: Cand[][] = [];
    let current: Cand[] = [];
    let groupEnd: string | null = null;
    for (const cand of candidates) {
      if (groupEnd === null || cand.start > groupEnd) {
        if (current.length) groups.push(current);
        current = [cand];
        groupEnd = cand.end;
      } else {
        current.push(cand);
        if (cand.end > groupEnd) groupEnd = cand.end;
      }
    }
    if (current.length) groups.push(current);

    const byDate: Record<string, BandEntry[]> = {};
    const occByDate: Record<string, LabelOccurrence[]> = {};

    const pushOccurrences = (cand: Cand, color: string) => {
      for (let d = cand.start; d <= cand.end; d = addDaysToDateStr(d, 1)) {
        if (d !== cand.start && !isMonday(d)) continue; // 시작일 또는 각 주의 첫 셀에서만
        const weekEnd = endOfGridWeek(d);
        const labelEnd = cand.end < weekEnd ? cand.end : weekEnd;
        const spanCells = daysBetween(d, labelEnd) + 1;
        (occByDate[d] ??= []).push({ title: cand.schedule.title, color, spanCells });
      }
    };

    for (const group of groups) {
      const ordered = [...group].sort(
        (a, b) => b.duration - a.duration || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)
      );

      const laneRanges: { start: string; end: string }[][] = [];

      for (const cand of ordered) {
        let lane = 0;
        while (laneRanges[lane]?.some((r) => cand.start <= r.end && r.start <= cand.end)) {
          lane++;
        }
        (laneRanges[lane] ??= []).push({ start: cand.start, end: cand.end });

        const color = getKeywordColor(cand.schedule.keyword_main);
        pushOccurrences(cand, color);

        if (lane >= MAX_BAND_ROWS) continue; // 라인 자리는 없음 — 이름은 이미 라벨에 반영됨

        for (let d = cand.start; d <= cand.end; d = addDaysToDateStr(d, 1)) {
          (byDate[d] ??= []).push({
            color,
            lane,
            isStart: d === cand.start,
            isEnd: d === cand.end,
            title: cand.schedule.title,
          });
        }
      }
    }

    return { bandsByDate: byDate, labelsByDate: occByDate };
  }, [schedules, monthStart, monthEnd]);

  // 도트는 하루짜리(기간이 아닌) 일정만 — 기간 일정은 전부 밴드 쪽(라인이든 overflow든)에서만
  // 표현하므로 여기서 완전히 제외한다(중복 표기 방지).
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
  // 바뀔 때마다 로컬 상태를 다시 맞춰준다.
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
  // 데이 시트가 열린 상태로 보여준다.
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

  // 태블릿 좌측 하단 "오늘" 버튼 — 지금 보고 있는 달이 이번 달이 아니면 먼저 이번 달로
  // 이동(그러면 selectedDate 초기값이 오늘로 다시 맞춰짐), 이미 이번 달이면 선택일만
  // 오늘로 바꾸고 우측 상세 패널을 스크롤 맨 위로 되돌린다.
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const handleTodayClick = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (!isCurrentMonth) {
      router.push(`/schedule?view=month&date=${todayStr}`);
      return;
    }
    setSelectedDate(todayStr);
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 좌우 스와이프로 이전/다음 달 이동 — 기존 <> 버튼과 같은 목적지(URL)를 그대로 재사용.
  // 데이 시트가 열려 있을 땐 날짜 선택/스크롤 제스처와 겹치지 않도록 비활성화.
  const { dragging, handlers, ...swipeNav } = useSwipeCalendarNav({
    value: anchorDate,
    onPrev: () => router.push(`/schedule?view=month&date=${addMonths(anchorDate, -1)}`),
    onNext: () => router.push(`/schedule?view=month&date=${addMonths(anchorDate, 1)}`),
    disabled: sheetOpen,
  });

  return (
    <div
      className={`flex h-full flex-col gap-4 overflow-x-hidden ${
        layout === "mobile" ? "pb-16" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between">
        <KeywordLegend />
        {/* 태블릿은 월 표기를 좌측 달력 칼럼 중앙 상단으로 옮겨서(아래 태블릿 블록 참고)
            여기 상단 바에서는 중복 표시하지 않는다. */}
        {layout === "mobile" && (
          <div className="flex items-center gap-4">
            <Link href={`/schedule?view=month&date=${addMonths(anchorDate, -1)}`} aria-label="이전 달">
              <IconChevronLeft size={20} className="text-stone" />
            </Link>
            <span className="text-[18px] font-medium text-ink">{formatYearMonth(anchorDate)}</span>
            <Link href={`/schedule?view=month&date=${addMonths(anchorDate, 1)}`} aria-label="다음 달">
              <IconChevronRight size={20} className="text-stone" />
            </Link>
          </div>
        )}
        <MemberFilterRow members={members} target={target} />
      </div>

      {/* 기본 상태: 달력이 남는 높이 전부(100%)를 씀 — 페이지 스크롤 없음(요구사항 1).
          날짜 탭: 50%로 압축 애니메이션(요구사항 2), 하단 절반엔 DaySheet(고정 위치, 자체
          슬라이드 트랜지션). 시트 닫힘: 다시 100%로(요구사항 3). 태블릿(useDeviceLayout)은
          이 압축+슬라이드 시트 구조 자체를 안 쓰고 아래 별도 태블릿 블록(좌 미니 달력 + 우
          고정 패널)으로 대체한다. */}
      {layout === "mobile" && (
      <div className="min-h-0 flex-1">
        <div
          className="flex h-full flex-col overflow-hidden"
          style={{ height: sheetOpen ? "50%" : "100%", transition: COMPRESS_TRANSITION }}
        >
          <div
            key={anchorDate}
            {...handlers}
            className="flex h-full flex-col"
            style={swipeCalendarNavStyle({ dragging, ...swipeNav })}
          >
            <MonthCalendarGrid
              cells={cells}
              weekRows={weekRows}
              todayStr={todayStr}
              highlightedDate={sheetOpen ? selectedDate : null}
              dotsByDate={dotsByDate}
              bandsByDate={bandsByDate}
              labelsByDate={labelsByDate}
              compressed={sheetOpen}
              onContainerClick={handleCalendarAreaTap}
              onSelectDate={(date) => {
                if (date === selectedDate && sheetOpen) {
                  setSheetOpen(false);
                } else {
                  setSelectedDate(date);
                  setSheetOpen(true);
                }
              }}
            />
          </div>
        </div>
      </div>
      )}

      {/* 태블릿(가로/세로): 좌 미니 달력(도트만, 밴드/라벨 없음) + 우 고정 상세 패널 — 날짜를
          선택해도 시트가 슬라이드하지 않고 우측 패널 내용만 바뀐다. DaySheetContent를
          모바일 DaySheet와 그대로 공유(마커·+·수정 문법 동일), 활동 제안은 여기서만
          "한 줄"로 노출(showActivitySuggestion). */}
      {layout !== "mobile" && (
      <div className="flex min-h-0 flex-1 gap-8">
        <div className="flex w-[42%] flex-col">
          {/* 월 표기를 이 칼럼 중앙 상단에 둔다(상단 공용 바는 태블릿에서 중복 표시 안 함) */}
          <div className="mb-2 flex shrink-0 items-center justify-center gap-4">
            <Link href={`/schedule?view=month&date=${addMonths(anchorDate, -1)}`} aria-label="이전 달">
              <IconChevronLeft size={20} className="text-stone" />
            </Link>
            <span className="text-[18px] font-medium text-ink">{formatYearMonth(anchorDate)}</span>
            <Link href={`/schedule?view=month&date=${addMonths(anchorDate, 1)}`} aria-label="다음 달">
              <IconChevronRight size={20} className="text-stone" />
            </Link>
          </div>

          <div
            key={`tablet-${anchorDate}`}
            {...handlers}
            style={swipeCalendarNavStyle({ dragging, ...swipeNav })}
            className="flex min-h-0 flex-1 flex-col"
          >
            <MonthCalendarGrid
              cells={cells}
              weekRows={weekRows}
              todayStr={todayStr}
              highlightedDate={selectedDate}
              dotsByDate={dotsByDate}
              bandsByDate={bandsByDate}
              labelsByDate={labelsByDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setHasManualSelection(true);
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleTodayClick}
            className="mt-2 shrink-0 self-center rounded-full bg-honey/10 px-4 py-1.5 text-[14px] font-medium text-honey"
          >
            오늘
          </button>
        </div>

        <div className="w-px shrink-0 bg-border-light" />

        <div ref={rightPanelRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <DaySheetContent
            date={selectedDate}
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
            showActivitySuggestion
            emphasizeToday={!hasManualSelection}
          />
        </div>
      </div>
      )}

      {layout === "mobile" && (
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
      )}

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
