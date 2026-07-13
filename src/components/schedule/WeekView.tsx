"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { toDateStr } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { isPeriodSchedule } from "@/lib/scheduleFormat";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { addDaysToDateStr, type ExpandedSchedule } from "@/lib/recurrence";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import { TodoChecklistItem } from "@/components/schedule/TodoChecklistItem";
import { GhostAddButton } from "@/components/schedule/GhostAddButton";
import { MemberFilterRow } from "@/components/schedule/MemberFilterRow";
import { toggleTodoDone } from "@/app/(main)/schedule/actions";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 이보다 짧게 움직인 터치는 스크롤로 간주하고 주 이동을 트리거하지 않는다.
const SWIPE_THRESHOLD_PX = 40;
// 날짜(좁은 고정폭) + 할 일(2) + 주요 일정(3) — 헤더 행과 본문 행이 같은 폭으로 렌더돼야
// 열 경계가 정확히 겹쳐서 세로 헤어라인이 끊기지 않고 이어져 보인다.
const TABLE_COLUMNS = "36px repeat(5, minmax(0, 1fr))";

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

/** 최상단은 좌우 스와이프(또는 화살표)로 주 단위 이동하는 네비게이터 — 월간 뷰의 월 이동과
 * 같은 자리에 있지만 여긴 터치 스와이프가 기본 인터랙션. 기간일정(여러 날짜에 걸친 일정)은
 * 상단에 별도 범례 바를 두지 않고, 그 일정이 걸치는 모든 날짜의 "주요 일정" 칸 맨 아래에
 * 아주 작은 글씨(8px, 흐린 톤)로 각자 표기한다 — 범례를 따로 두면 이미 모든 날짜 칸에
 * 나오는 내용과 중복이라 없앴다.
 *
 * 표 본문은 [날짜][할 일(2)][주요 일정(3)] 3열 — 요일마다 반복되는 행이 아니라, 모든
 * 날짜의 세 칸을 하나의 flat CSS grid(TABLE_COLUMNS)에 직접 자식으로 흘려 넣어서(날짜당
 * 1행씩 자동 줄바꿈) 열 경계가 모든 행에서 픽셀 단위로 정확히 겹치게 한다 — 그래서 칼럼
 * 사이 세로 헤어라인(border-l)이 한 줄로 이어져 보이고, 행 사이 가로 헤어라인(border-t)도
 * 세 칸이 동시에 끊김 없이 이어진다. 헤더 라벨("할 일"/"주요 일정")은 같은 열 템플릿을 쓰는
 * 별도의 작은 grid로 한 번만 렌더(요일마다 반복 안 함).
 *
 * 조작 문법은 월간 뷰와 동일하게 통일 — 상주 아이콘(연필) 없음:
 * 체크 원 탭 = 완료 토글, 텍스트 탭 = 수정 시트(TodoSheet), 일정 항목 탭 = 상세 시트
 * (ScheduleDetailSheet, 월간과 같은 경로), 빈 칸엔 흐린 "+" 고스트만(내용 있는 칸엔 없음 —
 * 추가는 고스트 아니면 하단 FAB). */
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
  const [todos, setTodos] = useState(weekTodos);
  const [overdue, setOverdue] = useState(overdueTodos);
  const touchStartX = useRef<number | null>(null);

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

  const goToWeek = (deltaDays: number) => {
    const nextAnchor = addDaysToDateStr(weekDates[0], deltaDays);
    router.push(`/schedule?view=week&date=${nextAnchor}`);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    goToWeek(delta < 0 ? 7 : -7);
  };

  const handleToggleTodo = (todo: Todo) => {
    const next = !todo.is_done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    setOverdue((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    toggleTodoDone(todo.id, next).catch(() => {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
      setOverdue((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
    });
  };

  return (
    <div className="flex flex-col gap-3" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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

      <div className="grid gap-3" style={{ gridTemplateColumns: TABLE_COLUMNS }}>
        <div />
        <span className="col-span-2 text-[10px] font-medium text-[var(--text-muted)]">할 일</span>
        <span className="col-span-3 border-l border-border-light pl-3 text-[10px] font-medium text-[var(--text-muted)]">
          주요 일정
        </span>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: TABLE_COLUMNS }}>
        {weekDates.map((date, i) => {
          // 기간일정(여러 날짜에 걸친 일정)은 일반 일정과 분리해서 그 날짜 칸 맨 아래에
          // 아주 작은 글씨로 따로 표기한다 — 상단 별도 범례 바는 없앴다(모든 날짜 칸에
          // 이미 나오니 범례가 그대로 중복이었음).
          const daySchedules = byDate[date].filter((s) => !isPeriodSchedule(s));
          const dayPeriods = byDate[date].filter(isPeriodSchedule);
          const day = new Date(date).getDate();
          const holiday = getHoliday(date);
          const isToday = date === todayStr;
          const dayTodos = sortTodos(
            isToday ? [...todosByDate[date], ...overdueSorted] : todosByDate[date]
          );
          const rowBorder = i > 0 ? "border-t border-border-light" : "";

          return (
            <Fragment key={date}>
              <div className={`py-1.5 ${rowBorder}`}>
                <span
                  className={`block text-[11px] font-medium ${
                    holiday ? "text-terra" : isToday ? "text-honey" : "text-ink"
                  }`}
                >
                  {WEEKDAY_LABELS[i]} {day}
                </span>
                {holiday && <span className="block text-[9px] text-terra">{holiday}</span>}
              </div>

              <div className={`col-span-2 flex flex-col py-1.5 ${rowBorder}`}>
                {dayTodos.length === 0 ? (
                  <GhostAddButton
                    onClick={() => setTodoSheetTarget({ mode: "add", date })}
                    label="할 일 추가"
                  />
                ) : (
                  dayTodos.map((t) => (
                    <TodoChecklistItem
                      key={t.id}
                      todo={t}
                      onToggle={() => handleToggleTodo(t)}
                      onOpenEdit={() => setTodoSheetTarget({ mode: "edit", todo: t })}
                    />
                  ))
                )}
              </div>

              <div className={`col-span-3 flex flex-col border-l border-border-light py-1.5 pl-3 ${rowBorder}`}>
                {daySchedules.length === 0 ? (
                  <GhostAddButton
                    onClick={() => setAddingScheduleDate(date)}
                    label="주요 일정 추가"
                  />
                ) : (
                  daySchedules.map((s, si) => (
                    <button
                      key={s.id}
                      onClick={() => setDetailSchedule(s)}
                      className={`flex flex-col gap-0.5 py-1 text-left ${
                        si > 0 ? "border-t border-border-light" : ""
                      }`}
                    >
                      <span
                        className={`truncate text-[11px] ${
                          s.is_important ? "font-medium text-terra" : "text-ink"
                        }`}
                      >
                        {s.title}
                      </span>
                      <span className="truncate text-[9px] text-stone">
                        {s.time_start ? s.time_start.slice(0, 5) : "종일"} ·{" "}
                        {targetLabel(s.target_members, membersById)}
                      </span>
                    </button>
                  ))
                )}
                {dayPeriods.length > 0 && (
                  <div className="mt-auto flex flex-col gap-0.5 pt-1">
                    {dayPeriods.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setDetailSchedule(s)}
                        className="flex min-w-0 items-center gap-1 text-left"
                      >
                        <span
                          className="h-[2px] w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: getKeywordColor(s.keyword_main), opacity: 0.55 }}
                        />
                        <span className="min-w-0 truncate text-[8px] text-[var(--text-muted)]">
                          {s.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>

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
