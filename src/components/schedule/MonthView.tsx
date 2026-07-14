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
// 기간 밴드는 겹쳐도 최대 이 줄 수까지만 쌓는다 — 넘치는 일정은 라인은 없지만 조합 라벨
// 텍스트(예: "생리/여름특강/유치원방학")에는 이름이 포함된다(아래 참고).
const MAX_BAND_ROWS = 2;
// 라인 두께·줄 간격 — 실제 렌더 크기(h-[2px], gap 2px)와 반드시 일치해야 라벨/라인 스택
// 높이 계산이 어긋나지 않는다. 이전엔 줄 간격이 1.5px(소수)라 일부 기기에서 두 줄이
// 시각적으로 붙어 하나의 두꺼운 선처럼 보이는 문제가 있었음 — 정수 2px로 고정.
const BAND_LINE_H = 2;
const BAND_LINE_GAP = 2;
const LINE_STACK_H = MAX_BAND_ROWS * BAND_LINE_H + (MAX_BAND_ROWS - 1) * BAND_LINE_GAP;
// 라인 스택과 라벨 사이 간격.
const BAND_LABEL_GAP = 2.5;
// 라벨 한 줄을 위해 항상 미리 예약해두는 세로 공간(라벨이 없는 날에도 동일하게 예약) —
// 이래야 라벨 유무와 무관하게 모든 셀의 행 높이가 완전히 똑같이 유지된다(레이어 분리).
// 시트가 열려 압축 모드일 땐 이 공간 자체를 0으로 접어 "도트+라인만" 남긴다.
const BAND_LABEL_ZONE_H = 11;

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
  // 겹치지 않게 최대 MAX_BAND_ROWS줄로 배정한다. 다 못 들어가는(overflow) 일정은 라인은 못
  // 그리지만 이름은 잃지 않는다 — 조합 라벨(겹치는 날 표기)에 자기 색으로 함께 나열된다.
  const { bandsByDate, overflowByDate } = useMemo(() => {
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

    const overflow: Record<string, { title: string; color: string }[]> = {};
    for (const cand of overflowCandidates) {
      const color = getKeywordColor(cand.schedule.keyword_main);
      for (let d = cand.start; d <= cand.end; d = addDaysToDateStr(d, 1)) {
        (overflow[d] ??= []).push({ title: cand.schedule.title, color });
      }
    }

    return { bandsByDate: byDate, overflowByDate: overflow };
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
            const overflowEntries = overflowByDate[date] ?? [];
            const activeCount = cellBands.length + overflowEntries.length;
            const grocery = dotSchedules.find((s) => s.is_grocery && s.amount);
            const isToday = date === todayStr;
            const isSelected = sheetOpen && date === selectedDate;
            const holiday = getHoliday(date);

            // 겹침 없는 날(활성 1개) — 그 밴드가 시작일일 때만 자기 이름 하나. 겹치는 날
            // (활성 2개 이상) — 라인에 못 들어간 overflow까지 포함해 전부 "이름/이름/이름"
            // 한 줄로(각자 자기 색), 시작일 여부와 무관하게 겹치는 모든 날 표기(구성이
            // 날마다 바뀔 수 있어서). 어느 쪽이든 라벨은 최대 1개 — 줄별 개별 라벨 없음.
            let labelNode: React.ReactNode = null;
            if (activeCount === 1 && cellBands[0]?.isStart) {
              const band = cellBands[0];
              labelNode = (
                <span
                  className="pointer-events-none absolute left-0 truncate text-[8px] leading-none"
                  style={{
                    bottom: LINE_STACK_H + BAND_LABEL_GAP,
                    width: `${band.spanCells * 100}%`,
                    color: band.color,
                    opacity: 0.55,
                  }}
                >
                  {band.title}
                </span>
              );
            } else if (activeCount >= 2) {
              const items = [
                ...cellBands.map((b) => ({ title: b.title, color: b.color })),
                ...overflowEntries,
              ];
              labelNode = (
                <span
                  className="pointer-events-none absolute left-0 w-full truncate text-[8px] leading-none"
                  style={{ bottom: LINE_STACK_H + BAND_LABEL_GAP }}
                >
                  {items.map((item, i) => (
                    <span key={i}>
                      {i > 0 && <span className="text-stone">/</span>}
                      <span style={{ color: item.color, opacity: 0.55 }}>{item.title}</span>
                    </span>
                  ))}
                </span>
              );
            }

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
                className={`flex flex-col items-center justify-center gap-0.5 ${sheetOpen ? "py-0" : "py-1"}`}
              >
                {/* 날짜 숫자 크기는 압축 여부와 무관하게 항상 동일 — 압축은 아래 부가 영역만 줄인다. */}
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
                <div className="flex gap-1" style={{ minHeight: sheetOpen ? 4 : 6 }}>
                  {dotSchedules.slice(0, 3).map((s) => (
                    <span
                      key={s.id}
                      className="h-[4px] w-[4px] rounded-full"
                      style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                    />
                  ))}
                </div>
                {grocery && !sheetOpen && (
                  <span className="text-[9px] text-[var(--text-muted)]">
                    {grocery.amount!.toLocaleString()}
                  </span>
                )}
                {/* 라인은 텍스트 유무와 무관하게 항상 같은 두께·같은 자리에 렌더(레이어 분리) —
                    라벨은 별도 position:absolute 오버레이라 이 컨테이너의 문서 흐름(높이
                    계산)에는 전혀 관여하지 않는다. 라벨 한 줄분 공간(BAND_LABEL_ZONE_H)은
                    라벨이 실제로 있든 없든 항상 동일하게 예약해둬 — 그래야 셀마다 행 높이가
                    달라지지 않는다. 시트가 열려 달력이 압축되면 이 예약 공간을 0으로 접어
                    라벨을 완전히 숨기고 도트+라인만 남긴다(요구사항 6). 라인은 justify-end로
                    항상 셀(정확히는 이 영역) 최하단에 붙고, 겹치는 날엔 최하단에서 위로
                    2px 간격으로 촘촘히 쌓인다 — 도트 영역과는 별도 존이라 어떤 경우에도
                    서로 겹치지 않는다. */}
                <span
                  className="relative flex w-full flex-col justify-end"
                  style={{
                    height: (sheetOpen ? 0 : BAND_LABEL_ZONE_H) + LINE_STACK_H,
                    paddingTop: sheetOpen ? 0 : BAND_LABEL_ZONE_H,
                    gap: BAND_LINE_GAP,
                  }}
                >
                  {cellBands.map((band) => (
                    <span
                      key={band.row}
                      className={`h-[2px] ${band.isStart ? "rounded-l-full" : ""} ${
                        band.isEnd ? "rounded-r-full" : ""
                      }`}
                      style={{ backgroundColor: band.color, opacity: 0.55 }}
                    />
                  ))}
                  {!sheetOpen && labelNode}
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
