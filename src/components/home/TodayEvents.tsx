"use client";

import Link from "next/link";
import { IconPaperclip } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { isPeriodSchedule } from "@/lib/scheduleFormat";
import { EventMarker } from "@/components/schedule/EventMarker";
import type { Schedule, Todo } from "@/types";

const PREVIEW_COUNT = 3;
// 그룹(기간 일정/주요 일정/할 일) 사이 구분선 — 0.5px 헤어라인 + 다음 그룹과의 여백.
const GROUP_DIVIDER = "border-t-[0.5px] border-border-light pt-row";

/** "오늘 뭐하지" — 순수 표시 컴포넌트. 상태(할 일 낙관적 토글/등록)는 부모(HomeTodaySection)가
 * 들고 있다가 props로 내려준다 — 예전엔 이 컴포넌트가 todos/overdue를 자체 useState로 복제해
 * 들고 있었는데, 부모가 "등록" 낙관적 업데이트까지 함께 관리하게 되면서 두 군데서 같은 목록을
 * 따로 들고 있으면 어긋나기 쉬워(이중 소스) 여기서는 완전히 제거하고 부모 단일 소스로 통일했다.
 *
 * 표시 순서/그룹: 기간 일정 → 주요 일정 → 할 일(오늘 마감 + 지난 할 일) — 세 그룹 사이에
 * 0.5px 헤어라인. 최대 3개까지만(그룹 우선순위 그대로 앞에서부터 채움) 보여주고 넘치면
 * "더보기". 마커(바/도트/체크 원)는 기존 규칙 그대로 EventMarker 공용 컴포넌트 사용. */
export function TodayEvents({
  todaySchedules,
  todos,
  overdueTodos,
  onToggleTodo,
}: {
  todaySchedules: Schedule[];
  todos: Todo[];
  overdueTodos: Todo[];
  onToggleTodo: (todo: Todo, isOverdue: boolean) => void;
}) {
  const periodSchedules = todaySchedules.filter(isPeriodSchedule);
  const singleSchedules = todaySchedules.filter((s) => !isPeriodSchedule(s));
  const todoEntries = [
    ...todos.map((t) => ({ todo: t, isOverdue: false })),
    ...overdueTodos.map((t) => ({ todo: t, isOverdue: true })),
  ];

  const combinedCount = periodSchedules.length + singleSchedules.length + todoEntries.length;

  // 우선순위(기간 일정 → 주요 일정 → 할 일) 그대로 앞에서부터 3개 슬롯을 채운다.
  let remaining = PREVIEW_COUNT;
  const visiblePeriod = periodSchedules.slice(0, remaining);
  remaining -= visiblePeriod.length;
  const visibleSingle = singleSchedules.slice(0, remaining);
  remaining -= visibleSingle.length;
  const visibleTodoEntries = todoEntries.slice(0, remaining);

  const hasPeriod = visiblePeriod.length > 0;
  const hasSingle = visibleSingle.length > 0;
  const hasTodo = visibleTodoEntries.length > 0;

  return (
    <div className="flex flex-col gap-row">
      {combinedCount > 0 && (
        <div className="flex flex-col gap-row">
          {hasPeriod && (
            <div className="flex flex-col gap-row">
              {visiblePeriod.map((s) => (
                <Link
                  key={s.id}
                  href={`/schedule?view=month&date=${s.date_start}&highlight=${s.id}`}
                  className="flex items-center gap-2"
                >
                  <EventMarker type="bar" color={getKeywordColor(s.keyword_main)} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      s.is_important ? "font-medium" : ""
                    } ${mirror.primary}`}
                  >
                    {s.title}
                  </span>
                  {s.memo && <IconPaperclip size={11} className={`shrink-0 ${mirror.muted}`} />}
                </Link>
              ))}
            </div>
          )}

          {hasSingle && (
            <div className={`flex flex-col gap-row ${hasPeriod ? GROUP_DIVIDER : ""}`}>
              {visibleSingle.map((s) => (
                <Link
                  key={s.id}
                  href={`/schedule?view=month&date=${s.date_start}&highlight=${s.id}`}
                  className="flex items-center gap-2"
                >
                  <EventMarker type="dot" color={getKeywordColor(s.keyword_main)} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      s.is_important ? "font-medium" : ""
                    } ${mirror.primary}`}
                  >
                    {s.title}
                  </span>
                  {s.memo && <IconPaperclip size={11} className={`shrink-0 ${mirror.muted}`} />}
                </Link>
              ))}
            </div>
          )}

          {hasTodo && (
            <div className={`flex flex-col gap-row ${hasPeriod || hasSingle ? GROUP_DIVIDER : ""}`}>
              {visibleTodoEntries.map(({ todo, isOverdue }) => (
                <button
                  key={todo.id}
                  onClick={() => onToggleTodo(todo, isOverdue)}
                  className="flex items-center gap-2 text-left"
                >
                  <EventMarker type="check" done={todo.is_done} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] ${
                      todo.is_done ? `line-through ${mirror.muted}` : mirror.primary
                    }`}
                  >
                    {todo.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {combinedCount > PREVIEW_COUNT && (
        <Link href="/schedule" className={`self-end text-[12px] ${mirror.muted}`}>
          더보기
        </Link>
      )}
    </div>
  );
}
