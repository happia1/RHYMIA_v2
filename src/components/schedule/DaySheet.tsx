"use client";

import { useEffect, useState } from "react";
import { DaySheetContent } from "@/components/schedule/DaySheetContent";
import { useSwipeDownToClose } from "@/components/ui/useSwipeDownToClose";
import type { MemberInfo } from "@/lib/scheduleTargets";
import type { ExpandedSchedule } from "@/lib/recurrence";
import type { Todo } from "@/types";

/** 월간 뷰 "달력 주인공 + 호출형 하단 시트" — 날짜를 탭하면 달력 위에 압축된 채 함께
 * 떠 있는 하단 시트. 일반 모달(`BottomSheet`)과 달리 어두운 배경 오버레이가 없다 —
 * 달력이 시트 뒤가 아니라 시트 "위"에 그대로 남아 계속 탭 가능해야(다른 날짜 선택 시
 * 시트 내용만 교체) 하기 때문에 화면 전체를 덮는 모달 구조를 쓸 수 없다. 닫힘은
 * 같은 날짜 재탭/이 시트 스와이프 다운/달력 영역 탭 세 가지 경로로 모두 부모
 * (`MonthView`)의 `onClose`를 호출하는 방식으로 통일. 실제 내용(기간 바/주요 일정/할
 * 일/작년 이맘때)은 `DaySheetContent`가 담당 — 태블릿 월간 뷰의 고정 우측 패널과 공유. */
export function DaySheet({
  open,
  date,
  onClose,
  schedules,
  membersById,
  highlightId,
  onOpenSchedule,
  onAddSchedule,
  todos,
  onToggleTodo,
  onOpenTodoEdit,
  onAddTodo,
  lastYearHighlights,
  onOpenLastYear,
  workspaceId,
  activitySuggestion,
  activityCandidates,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  schedules: ExpandedSchedule[];
  membersById: Record<string, MemberInfo>;
  highlightId?: string;
  onOpenSchedule: (s: ExpandedSchedule) => void;
  onAddSchedule: () => void;
  todos: Todo[];
  onToggleTodo: (t: Todo) => void;
  onOpenTodoEdit: (t: Todo) => void;
  onAddTodo: () => void;
  lastYearHighlights: ExpandedSchedule[];
  onOpenLastYear: (h: ExpandedSchedule) => void;
  workspaceId: string;
  activitySuggestion: string;
  activityCandidates: string[];
}) {
  const [mounted, setMounted] = useState(open);
  const { dragY, dragging, handlers } = useSwipeDownToClose(onClose);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      {...handlers}
      onTransitionEnd={() => {
        if (!open) setMounted(false);
      }}
      className={`fixed inset-x-0 bottom-0 z-50 flex h-[50dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${
        dragging ? "" : "transition-transform duration-200"
      } ${open ? "translate-y-0" : "translate-y-full"}`}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <div className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-full bg-[#E8E6E0]" />

      <DaySheetContent
        date={date}
        schedules={schedules}
        membersById={membersById}
        highlightId={highlightId}
        onOpenSchedule={onOpenSchedule}
        onAddSchedule={onAddSchedule}
        todos={todos}
        onToggleTodo={onToggleTodo}
        onOpenTodoEdit={onOpenTodoEdit}
        onAddTodo={onAddTodo}
        lastYearHighlights={lastYearHighlights}
        onOpenLastYear={onOpenLastYear}
        workspaceId={workspaceId}
        activitySuggestion={activitySuggestion}
        activityCandidates={activityCandidates}
      />
    </div>
  );
}
