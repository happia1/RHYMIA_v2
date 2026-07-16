"use client";

import { useState } from "react";
import Link from "next/link";
import { IconPaperclip } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { isPeriodSchedule } from "@/lib/scheduleFormat";
import { EventMarker } from "@/components/schedule/EventMarker";
import { toggleTodoDone } from "@/app/(main)/schedule/actions";
import type { Schedule, Todo } from "@/types";

const PREVIEW_COUNT = 3;

/** "오늘 뭐하지" — 오늘 일정 + 오늘 마감 할 일 + 지난(이월) 할 일을 이 순서로 합쳐 최대
 * 3개까지 보여주고(전체 목록/이번 주 보기는 일정 탭 전담), 넘치면 "더보기". 일정은 탭하면
 * 일정 탭으로 이동하고, 할 일은 탭하면 그 자리에서 바로 완료 토글(낙관적 업데이트) — 일정
 * 탭 선택일 패널의 체크 인터랙션과 동일. 마커(도트/기간 바/체크 원)는 전부 같은 16px
 * 슬롯에서 중앙 정렬돼 텍스트 시작점이 항목 종류와 무관하게 통일된다. */
export function TodayEvents({
  todaySchedules,
  todayTodos,
  overdueTodos,
}: {
  todaySchedules: Schedule[];
  todayTodos: Todo[];
  overdueTodos: Todo[];
}) {
  const [todos, setTodos] = useState(todayTodos);
  const [overdue, setOverdue] = useState(overdueTodos);

  const handleToggle = (todo: Todo, isOverdue: boolean) => {
    const next = !todo.is_done;
    const setter = isOverdue ? setOverdue : setTodos;
    setter((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    toggleTodoDone(todo.id, next).catch(() => {
      setter((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
    });
  };

  const combinedCount = todaySchedules.length + todos.length + overdue.length;
  const visibleSchedules = todaySchedules.slice(0, PREVIEW_COUNT);
  const visibleTodos = todos.slice(0, Math.max(0, PREVIEW_COUNT - visibleSchedules.length));
  const visibleOverdue = overdue.slice(
    0,
    Math.max(0, PREVIEW_COUNT - visibleSchedules.length - visibleTodos.length)
  );

  return (
    <div className="flex flex-col gap-row">
      {combinedCount > 0 && (
        <div className="flex flex-col gap-row">
          {visibleSchedules.map((s) => (
            <Link
              key={s.id}
              href={`/schedule?view=month&date=${s.date_start}&highlight=${s.id}`}
              className="flex items-center gap-2"
            >
              <EventMarker
                type={isPeriodSchedule(s) ? "bar" : "dot"}
                color={getKeywordColor(s.keyword_main)}
              />
              <span
                className={`min-w-0 flex-1 truncate text-[11px] ${
                  s.is_important ? "font-medium" : ""
                } ${mirror.primary}`}
              >
                {s.title}
              </span>
              {s.memo && <IconPaperclip size={11} className={`shrink-0 ${mirror.muted}`} />}
            </Link>
          ))}
          {[...visibleTodos.map((t) => ({ todo: t, isOverdue: false })), ...visibleOverdue.map((t) => ({ todo: t, isOverdue: true }))].map(
            ({ todo, isOverdue }) => (
              <button
                key={todo.id}
                onClick={() => handleToggle(todo, isOverdue)}
                className="flex items-center gap-2 text-left"
              >
                <EventMarker type="check" done={todo.is_done} />
                <span
                  className={`min-w-0 flex-1 truncate text-[11px] ${
                    todo.is_done ? `line-through ${mirror.muted}` : mirror.primary
                  }`}
                >
                  {todo.title}
                </span>
              </button>
            )
          )}
        </div>
      )}

      {combinedCount > PREVIEW_COUNT && (
        <Link href="/schedule" className={`self-end text-[11px] ${mirror.muted}`}>
          더보기
        </Link>
      )}
    </div>
  );
}
