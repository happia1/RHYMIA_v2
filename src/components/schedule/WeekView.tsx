"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { toDateStr } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { isPeriodSchedule } from "@/lib/scheduleFormat";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { addDaysToDateStr, type ExpandedSchedule } from "@/lib/recurrence";
import { useSwipeCalendarNav, swipeCalendarNavStyle } from "@/components/schedule/useSwipeCalendarNav";
import { PeriodBarRow } from "@/components/schedule/PeriodBarRow";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import { TodoChecklistItem } from "@/components/schedule/TodoChecklistItem";
import { EventMarker } from "@/components/schedule/EventMarker";
import { AddTemplatePicker, type TemplateType } from "@/components/schedule/AddTemplatePicker";
import { MemberFilterRow } from "@/components/schedule/MemberFilterRow";
import { toggleTodoDone } from "@/app/(main)/schedule/actions";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

type TodoSheetTarget = { mode: "add"; date: string } | { mode: "edit"; todo: Todo };

function scheduleOverlapsDay(s: ExpandedSchedule, date: string) {
  const end = s.date_end ?? s.date_start;
  return s.date_start <= date && date <= end;
}

// 완료 항목은 하단으로 — Array.sort는 안정 정렬이라 같은 is_done끼리는 원래 순서(등록순)를 유지한다.
function sortTodos(list: Todo[]) {
  return [...list].sort((a, b) => Number(a.is_done) - Number(b.is_done));
}

function formatWeekRange(dates: string[]) {
  const md = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    return `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
  };
  return `${md(dates[0])} – ${md(dates[6])}`;
}

/** 최상단은 좌우 스와이프(또는 화살표)로 주 단위 이동하는 네비게이터 — 월간/연간 뷰와
 * 같은 공용 훅(useSwipeCalendarNav)을 쓴다. 기간일정(여러 날짜에 걸친 일정)은 요일 행마다
 * 반복해서 보여주지 않고, 그 주에 걸친 기간을 주 최상단에 한 번씩만 [색 바] 이름 · 범위로
 * 나열한다(PeriodBarRow, 월간 데이 시트와 공유하는 컴포넌트) — 표 길이를 줄이는 게 목적.
 *
 * 표 본문은 요일마다 세로 1열(일정 먼저 → 할 일) — 예전엔 [날짜][주요 일정][할 일] 3열
 * 그리드였는데, 하루짜리 일정이 이제 풀폭을 다 쓰므로 제목이 덜 잘린다. 각 요일 행 우상단의
 * "+" 하나로 통일해(AddTemplatePicker) 일정/할 일 중 고르게 한다 — 예전처럼 칸이 비어있을
 * 때만 뜨는 고스트 버튼 두 개로 나뉘어 있지 않다. */
export function WeekView({
  weekDates,
  schedules,
  membersById,
  workspaceId,
  weekTodos,
  overdueTodos,
  members,
  target,
}: {
  weekDates: string[];
  schedules: ExpandedSchedule[];
  membersById: Record<string, MemberInfo>;
  workspaceId: string;
  /** 이번 주 범위 안, due_date 기준 할 일 — 날짜별 체크리스트에서 due_date === 그 날짜로 필터링 */
  weekTodos: Todo[];
  /** 마감일이 지났는데 아직 완료 안 한 할 일 — 오늘 날짜 블록에만 "지난 할 일"로 함께 표시 */
  overdueTodos: Todo[];
  /** 상단 네비게이터 오른쪽의 멤버 필터 드롭다운용 */
  members: { id: string; display_name: string; avatar_color: string }[];
  target: string;
}) {
  const router = useRouter();
  const todayStr = toDateStr(new Date());
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<ExpandedSchedule | null>(null);
  const [addingScheduleDate, setAddingScheduleDate] = useState<string | null>(null);
  const [todoSheetTarget, setTodoSheetTarget] = useState<TodoSheetTarget | null>(null);
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [todos, setTodos] = useState(weekTodos);
  const [overdue, setOverdue] = useState(overdueTodos);

  useEffect(() => setTodos(weekTodos), [weekTodos]);
  useEffect(() => setOverdue(overdueTodos), [overdueTodos]);

  const byDate: Record<string, ExpandedSchedule[]> = {};
  for (const date of weekDates) byDate[date] = [];
  for (const s of schedules) {
    for (const date of weekDates) {
      if (scheduleOverlapsDay(s, date)) byDate[date].push(s);
    }
  }

  const todosByDate: Record<string, Todo[]> = {};
  for (const date of weekDates) todosByDate[date] = [];
  for (const t of todos) {
    if (t.due_date && todosByDate[t.due_date]) todosByDate[t.due_date].push(t);
  }
  const overdueSorted = useMemo(() => sortTodos(overdue), [overdue]);

  // schedules는 이미 이번 주 범위로 조회된 flat 배열(중복 없음) — 기간일정만 뽑아 시작일
  // 순으로 한 번씩만 나열한다(요구사항 4).
  const weekPeriods = useMemo(
    () =>
      schedules
        .filter(isPeriodSchedule)
        .sort((a, b) => (a.date_start < b.date_start ? -1 : a.date_start > b.date_start ? 1 : 0)),
    [schedules]
  );

  const goToWeek = (deltaDays: number) => {
    const nextAnchor = addDaysToDateStr(weekDates[0], deltaDays);
    router.push(`/schedule?view=week&date=${nextAnchor}`);
  };

  const { dragging, handlers, ...swipeNav } = useSwipeCalendarNav({
    value: weekDates[0],
    onPrev: () => goToWeek(-7),
    onNext: () => goToWeek(7),
  });

  const handleToggleTodo = (todo: Todo) => {
    const next = !todo.is_done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    setOverdue((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    toggleTodoDone(todo.id, next).catch(() => {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
      setOverdue((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
    });
  };

  const handlePickTemplate = (type: TemplateType) => {
    const date = pickerDate;
    setPickerDate(null);
    if (!date) return;
    if (type === "event") setAddingScheduleDate(date);
    else setTodoSheetTarget({ mode: "add", date });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <div />
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => goToWeek(-7)} aria-label="이전 주">
            <IconChevronLeft size={20} className="text-stone" />
          </button>
          <span className="whitespace-nowrap text-[13px] font-medium text-ink">
            {formatWeekRange(weekDates)}
          </span>
          <button onClick={() => goToWeek(7)} aria-label="다음 주">
            <IconChevronRight size={20} className="text-stone" />
          </button>
        </div>
        <div className="flex justify-end">
          <MemberFilterRow members={members} target={target} />
        </div>
      </div>

      <div key={weekDates[0]} {...handlers} style={swipeCalendarNavStyle({ dragging, ...swipeNav })} className="flex flex-col gap-3">
        {weekPeriods.length > 0 && (
          <div className="flex flex-col gap-2.5 border-b border-border-light pb-3">
            {weekPeriods.map((s) => (
              <PeriodBarRow key={s.id} schedule={s} onClick={() => setDetailSchedule(s)} />
            ))}
          </div>
        )}

        <div className="flex flex-col">
          {weekDates.map((date, i) => {
            const daySchedules = byDate[date].filter((s) => !isPeriodSchedule(s));
            const day = new Date(date).getDate();
            const holiday = getHoliday(date);
            const isToday = date === todayStr;
            const isSaturday = i === 5;
            const isSunday = i === 6;
            const dayTodos = sortTodos(
              isToday ? [...todosByDate[date], ...overdueSorted] : todosByDate[date]
            );
            const isEmpty = daySchedules.length === 0 && dayTodos.length === 0;

            return (
              <div key={date} className={`flex flex-col gap-1.5 py-2.5 ${i > 0 ? "border-t border-border-light" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={`text-[13px] font-medium ${
                        isToday
                          ? "text-honey"
                          : holiday || isSunday
                          ? "text-terra"
                          : isSaturday
                          ? "text-ocean"
                          : "text-ink"
                      }`}
                    >
                      {WEEKDAY_LABELS[i]} {day}
                    </span>
                    {holiday && <span className="text-[11px] text-terra">{holiday}</span>}
                  </span>
                  <button
                    onClick={() => setPickerDate(date)}
                    aria-label="일정/할 일 추가"
                    className="p-1 -m-1 text-[var(--text-muted)]"
                  >
                    <IconPlus size={16} />
                  </button>
                </div>

                {isEmpty && <p className="text-[12px] text-[var(--text-muted)]">등록된 게 없어요</p>}

                {daySchedules.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {daySchedules.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setDetailSchedule(s)}
                        className="flex w-full items-center gap-2 py-0.5 text-left"
                      >
                        <EventMarker type="dot" color={getKeywordColor(s.keyword_main)} />
                        <span
                          className={`min-w-0 flex-1 truncate text-[13px] ${
                            s.is_important ? "font-medium text-terra" : "text-ink"
                          }`}
                        >
                          {s.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-stone">
                          {s.time_start ? s.time_start.slice(0, 5) : "종일"} ·{" "}
                          {targetLabel(s.target_members, membersById)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {dayTodos.length > 0 && (
                  <div className="flex flex-col">
                    {dayTodos.map((t) => (
                      <TodoChecklistItem
                        key={t.id}
                        todo={t}
                        onToggle={() => handleToggleTodo(t)}
                        onOpenEdit={() => setTodoSheetTarget({ mode: "edit", todo: t })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AddTemplatePicker
        open={!!pickerDate}
        onClose={() => setPickerDate(null)}
        onSelect={handlePickTemplate}
      />

      <AddEventSheet
        open={!!editingSchedule || !!addingScheduleDate}
        onClose={() => {
          setEditingSchedule(null);
          setAddingScheduleDate(null);
        }}
        workspaceId={workspaceId}
        members={Object.entries(membersById).map(([id, m]) => ({ id, display_name: m.display_name }))}
        defaultDate={editingSchedule?.date_start ?? addingScheduleDate ?? weekDates[0]}
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
