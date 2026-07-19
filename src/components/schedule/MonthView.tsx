"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { formatYearMonth, addMonths } from "@/lib/date";
import { useSwipeCalendarNav, swipeCalendarNavStyle } from "@/components/schedule/useSwipeCalendarNav";
import { getHoliday } from "@/lib/holidays";
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
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 기간 밴드는 겹쳐도 최대 이 줄 수까지만 라인으로 그린다 — 넘치는 일정은 라인은 없지만
// 조합 라벨 텍스트(예: "여름특강/유치원방학")에는 이름이 계속 포함된다.
const MAX_BAND_ROWS = 2;
// 라인 두께·줄 간격 — 실제 렌더 크기(h-[2px], gap 2px)와 반드시 일치해야 라벨/라인 스택
// 높이 계산이 어긋나지 않는다.
const BAND_LINE_H = 2;
const BAND_LINE_GAP = 2;
const LINE_STACK_H = MAX_BAND_ROWS * BAND_LINE_H + (MAX_BAND_ROWS - 1) * BAND_LINE_GAP;
// 라인 스택과 라벨 사이 간격.
const BAND_LABEL_GAP = 2.5;
// 라벨 한 줄을 위해 항상 미리 예약해두는 세로 공간(라벨이 없는 날에도 동일하게 예약) —
// 이래야 라벨 유무와 무관하게 모든 셀의 행 높이가 완전히 똑같이 유지된다(레이어 분리).
// 시트가 열려 압축 모드일 땐 이 공간 자체를 0으로 접어 "도트+라인만" 남긴다.
const BAND_LABEL_ZONE_H = 11;
// 달력 ↔ 데이 시트 전환 애니메이션 지속시간 — DaySheet(useSwipeDownToClose 기반 슬라이드)와
// 같은 값을 써서 "압축"과 "시트 등장"이 같은 박자로 움직이게 한다.
const COMPRESS_TRANSITION = "height 200ms cubic-bezier(0.4, 0, 0.2, 1)";

type TodoSheetTarget = { mode: "add"; date: string } | { mode: "edit"; todo: Todo };

type BandEntry = {
  color: string;
  lane: number;
  isStart: boolean;
  isEnd: boolean;
  title: string;
};

type LabelOccurrence = { title: string; color: string; spanCells: number };

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

// 0=일 ... 6=토 (JS Date와 동일 규약).
function dowOf(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
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

// 요일/공휴일 색 — 다크 배경에서 눈에 편한 저채도 톤을 쓰기 위해 원색 대신 기존 브랜드
// 토큰(ocean/terra)을 재사용한다. 토요일은 ocean(파랑 계열), 일요일·공휴일은 terra(빨강
// 계열) — 우선순위는 호출부에서 today/selected보다 낮게 적용.
function weekendColorClass(dateStr: string, holiday: string | null) {
  if (holiday || dowOf(dateStr) === 0) return "text-terra";
  if (dowOf(dateStr) === 6) return "text-ocean";
  return null;
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

  // 태블릿 미니 달력의 도트 — 모바일처럼 기간/하루짜리를 밴드·라인으로 구분해 그리지 않고
  // (공간이 좁아 그럴 자리가 없음), 그날 일정이 하나라도 걸쳐 있으면 점 하나만 찍는다.
  const hasScheduleByDate = useMemo(() => {
    const set = new Set<string>();
    for (const date of cells) {
      if (date && schedules.some((s) => scheduleOverlapsDay(s, date))) set.add(date);
    }
    return set;
  }, [cells, schedules]);

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

  // 좌우 스와이프로 이전/다음 달 이동 — 기존 <> 버튼과 같은 목적지(URL)를 그대로 재사용.
  // 데이 시트가 열려 있을 땐 날짜 선택/스크롤 제스처와 겹치지 않도록 비활성화.
  const { dragging, handlers, ...swipeNav } = useSwipeCalendarNav({
    value: anchorDate,
    onPrev: () => router.push(`/schedule?view=month&date=${addMonths(anchorDate, -1)}`),
    onNext: () => router.push(`/schedule?view=month&date=${addMonths(anchorDate, 1)}`),
    disabled: sheetOpen,
  });

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

      {/* 기본 상태: 달력이 남는 높이 전부(100%)를 씀 — 페이지 스크롤 없음(요구사항 1).
          날짜 탭: 50%로 압축 애니메이션(요구사항 2), 하단 절반엔 DaySheet(고정 위치, 자체
          슬라이드 트랜지션). 시트 닫힘: 다시 100%로(요구사항 3). 1024px 이상은 이 압축+
          슬라이드 시트 구조 자체를 안 쓰고 아래 별도 태블릿 블록(좌 미니 달력 + 우 고정
          패널)으로 대체한다. */}
      <div className="min-h-0 flex-1 lg:hidden">
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
            <div className="grid shrink-0 grid-cols-7 pb-1 text-center">
              {WEEKDAY_LABELS.map((wd, i) => (
                <span
                  key={wd}
                  className={`text-[11px] ${
                    i === 6 ? "text-terra" : i === 5 ? "text-ocean" : "text-[var(--text-muted)]"
                  }`}
                >
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
              const cellBands = (bandsByDate[date] ?? []).slice().sort((a, b) => a.lane - b.lane);
              const labelOccurrences = labelsByDate[date] ?? [];
              const grocery = dotSchedules.find((s) => s.is_grocery && s.amount);
              const isToday = date === todayStr;
              const isSelected = sheetOpen && date === selectedDate;
              const holiday = getHoliday(date);
              const weekendClass = weekendColorClass(date, holiday);

              // 라벨은 최대 1개 — 그 위치(시작일/주 첫 셀)에 걸친 기간이 하나면 자기 이름,
              // 둘 이상이면 "이름/이름" 조합(요구사항 6, 줄별 개별 표기 없음).
              let labelNode: React.ReactNode = null;
              // 텍스트 기준점은 항상 그 주에서 기간이 차지하는 구간의 왼쪽 끝(시작 셀의
              // 좌측) — 부모 day-grid의 text-center가 상속돼 절대 위치 오버레이 안에서도
              // 글자가 중앙 정렬되는 버그가 있었다(박스 위치는 left:0로 고정해도 text-align은
              // 별개라 그 안의 텍스트만 가운데로 쏠림) → text-left로 명시 오버라이드.
              // 폭도 "occ.spanCells * 100%"(칸 수 그대로)를 다 쓰면 말줄임표(...)가 렌더될
              // 여백이 없어 텍스트가 셀 경계에서 그냥 잘려 사라져 보였다 → 4px 여백을 빼
              // 실제 가용 폭을 살짝 좁혀 "..."이 항상 보이게 한다.
              if (labelOccurrences.length === 1) {
                const occ = labelOccurrences[0];
                labelNode = (
                  <span
                    className="pointer-events-none absolute left-0 truncate text-left text-[8px] leading-none"
                    style={{
                      bottom: LINE_STACK_H + BAND_LABEL_GAP,
                      width: `calc(${occ.spanCells * 100}% - 4px)`,
                      color: occ.color,
                      opacity: 0.55,
                    }}
                  >
                    {occ.title}
                  </span>
                );
              } else if (labelOccurrences.length >= 2) {
                // 단일 라벨과 동일한 규칙 — 합쳐진 라벨도 그 중 가장 넓게 뻗는 기간의
                // spanCells를 폭으로 써야 그 주에서 실제로 쓸 수 있는 라인 폭만큼 보인다.
                // 이전엔 무조건 한 칸(셀 1개) 폭으로 고정돼 있어서 "여름특강/유치원방학"처럼
                // 합쳐진 이름이 길면 실제 밴드 라인보다 훨씬 먼저 잘렸다.
                const maxSpanCells = Math.max(...labelOccurrences.map((occ) => occ.spanCells));
                labelNode = (
                  <span
                    className="pointer-events-none absolute left-0 truncate text-left text-[8px] leading-none"
                    style={{
                      bottom: LINE_STACK_H + BAND_LABEL_GAP,
                      width: `calc(${maxSpanCells * 100}% - 4px)`,
                    }}
                  >
                    {labelOccurrences.map((occ, oi) => (
                      <span key={oi}>
                        {oi > 0 && <span className="text-stone">/</span>}
                        <span style={{ color: occ.color, opacity: 0.55 }}>{occ.title}</span>
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
                        : weekendClass
                        ? `font-medium ${weekendClass}`
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
                  {/* 라인은 텍스트 유무와 무관하게 항상 같은 두께로 렌더(레이어 분리) — 라벨은
                      별도 position:absolute 오버레이라 이 컨테이너의 문서 흐름(높이 계산)에는
                      전혀 관여하지 않는다. 라벨 한 줄분 공간(BAND_LABEL_ZONE_H)은 라벨이
                      실제로 있든 없든 항상 동일하게 예약해둬 셀마다 행 높이가 달라지지
                      않는다. 시트가 열려 압축되면 이 예약 공간을 0으로 접어 라벨을 완전히
                      숨기고 도트+라인만 남긴다(요구사항 2).
                      flex-col-reverse: lane 0(그룹 내 가장 긴 기간, "맨 아래 레인")이 배열의
                      첫 항목이라 역방향 배치에서 셀 최하단에 오고, 그 위로 lane 1이 쌓인다.
                      그날 실제로 활성인 lane만 렌더하므로(고정 슬롯 아님) 겹침 없는 날엔
                      자동으로 셀 최하단에 온다(요구사항 5). */}
                  <span
                    className="relative flex w-full flex-col-reverse"
                    style={{
                      height: (sheetOpen ? 0 : BAND_LABEL_ZONE_H) + LINE_STACK_H,
                      paddingTop: sheetOpen ? 0 : BAND_LABEL_ZONE_H,
                      gap: BAND_LINE_GAP,
                    }}
                  >
                    {cellBands.map((band) => (
                      <span
                        key={band.lane}
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
        </div>
      </div>

      {/* 태블릿(1024px~): 좌 미니 달력(도트만, 밴드/라벨 없음) + 우 고정 상세 패널 — 날짜를
          선택해도 시트가 슬라이드하지 않고 우측 패널 내용만 바뀐다. DaySheetContent를
          모바일 DaySheet와 그대로 공유(마커·+·수정 문법 동일), 활동 제안은 여기서만
          "한 줄"로 노출(showActivitySuggestion). */}
      <div className="hidden min-h-0 flex-1 lg:flex lg:gap-8">
        <div className="flex w-[42%] flex-col">
          <div
            key={`tablet-${anchorDate}`}
            {...handlers}
            style={swipeCalendarNavStyle({ dragging, ...swipeNav })}
            className="flex flex-col"
          >
            <div className="grid grid-cols-7 pb-1 text-center">
              {WEEKDAY_LABELS.map((wd, i) => (
                <span
                  key={wd}
                  className={`text-[11px] ${
                    i === 6 ? "text-terra" : i === 5 ? "text-ocean" : "text-[var(--text-muted)]"
                  }`}
                >
                  {wd}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center">
              {cells.map((date, i) => {
                if (!date) return <div key={`tablet-empty-${i}`} />;
                const isToday = date === todayStr;
                const isSelected = date === selectedDate;
                const holiday = getHoliday(date);
                const weekendClass = weekendColorClass(date, holiday);
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className="flex flex-col items-center gap-1 py-1"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${
                        isToday
                          ? "bg-honey/15 font-medium text-honey"
                          : isSelected
                          ? "font-medium text-honey ring-1 ring-honey/40"
                          : weekendClass
                          ? `font-medium ${weekendClass}`
                          : "text-ink"
                      }`}
                    >
                      {Number(date.slice(-2))}
                    </span>
                    <span
                      className={`h-[4px] w-[4px] rounded-full ${
                        hasScheduleByDate.has(date) ? "bg-honey" : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="w-px shrink-0 bg-border-light" />

        <div className="min-h-0 flex-1 overflow-y-auto">
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
          />
        </div>
      </div>

      <div className="lg:hidden">
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
      </div>

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
