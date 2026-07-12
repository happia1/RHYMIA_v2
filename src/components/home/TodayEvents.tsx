"use client";

import { useState } from "react";
import Link from "next/link";
import { IconPaperclip, IconCheck } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { toggleTodoDone } from "@/app/(main)/schedule/actions";
import type { Schedule, Todo } from "@/types";

function isPeriodSchedule(s: Schedule) {
  return Boolean(s.date_end && s.date_end !== s.date_start);
}

const PREVIEW_COUNT = 3;

/** "오늘 뭐하지" — 오늘 일정 + 오늘 마감인 미완료 할 일을 합쳐 최대 3개까지 보여주고
 * (전체 목록/이번 주 보기는 일정 탭 전담), 넘치면 "더보기". 일정은 탭하면 일정 탭으로
 * 이동하고, 할 일은 탭하면 그 자리에서 바로 완료 토글(낙관적 업데이트) — 일정 탭 선택일
 * 패널의 체크 인터랙션과 동일. 제목 앞 표시는 장바구니 항목 도트(3px)와 같은 스타일 —
 * 당일 하루 일정은 점, 기간(여러 날) 일정은 짧은 바로 구분한다. */
export function TodayEvents({
  todaySchedules,
  todayTodos,
}: {
  todaySchedules: Schedule[];
  todayTodos: Todo[];
}) {
  const [todos, setTodos] = useState(todayTodos);

  const handleToggle = (todo: Todo) => {
    const next = !todo.is_done;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    toggleTodoDone(todo.id, next).catch(() => {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
    });
  };

  const combinedCount = todaySchedules.length + todos.length;
  const visibleSchedules = todaySchedules.slice(0, PREVIEW_COUNT);
  const visibleTodos = todos.slice(0, Math.max(0, PREVIEW_COUNT - visibleSchedules.length));

  return (
    <div className="flex flex-col gap-row">
      {combinedCount > 0 && (
        <div className="flex flex-col gap-row">
          {visibleSchedules.map((s) => {
            const color = getKeywordColor(s.keyword_main);
            return (
              <Link
                key={s.id}
                href={`/schedule?view=month&date=${s.date_start}&highlight=${s.id}`}
                className="flex items-center gap-2"
              >
                {isPeriodSchedule(s) ? (
                  <span
                    className="h-[2px] w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ) : (
                  <span
                    className="h-[3px] w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span
                  className={`min-w-0 flex-1 truncate text-[11px] ${
                    s.is_important ? "font-medium" : ""
                  } ${mirror.primary}`}
                >
                  {s.title}
                </span>
                {s.memo && <IconPaperclip size={11} className={`shrink-0 ${mirror.muted}`} />}
              </Link>
            );
          })}
          {visibleTodos.map((t) => (
            <button
              key={t.id}
              onClick={() => handleToggle(t)}
              className="flex items-center gap-2 text-left"
            >
              <span
                className={`flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-full border ${
                  t.is_done ? "border-sage bg-sage" : mirror.hairline
                }`}
              >
                {t.is_done && <IconCheck size={8} className="text-white" stroke={3.5} />}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[11px] ${
                  t.is_done ? `line-through ${mirror.muted}` : mirror.primary
                }`}
              >
                {t.title}
              </span>
            </button>
          ))}
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
