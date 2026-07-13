"use client";

import { useEffect, useRef, useState } from "react";
import { getHoliday } from "@/lib/holidays";
import { solarToLunar } from "@/lib/lunar";
import { shortRange } from "@/lib/scheduleFormat";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { GhostAddButton } from "@/components/schedule/GhostAddButton";
import { TodoChecklistItem } from "@/components/schedule/TodoChecklistItem";
import { ActivitySuggestionSection } from "@/components/schedule/ActivitySuggestionSection";
import { SectionExpand } from "@/components/ui/SectionExpand";
import type { ExpandedSchedule } from "@/lib/recurrence";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 이보다 많이(px) 끌어내리면 스와이프로 시트를 닫는다.
const SWIPE_CLOSE_THRESHOLD_PX = 70;

function formatHeader(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const weekday = WEEKDAY_LABELS[(d.getUTCDay() + 6) % 7];
  const lunar = solarToLunar(d);
  const lunarPart = lunar ? ` · 음력 ${lunar.month}.${lunar.day}` : "";
  return `${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${weekday}${lunarPart}`;
}

/** 월간 뷰 "달력 주인공 + 호출형 하단 시트" — 날짜를 탭하면 달력 위에 압축된 채 함께
 * 떠 있는 하단 시트. 일반 모달(`BottomSheet`)과 달리 어두운 배경 오버레이가 없다 —
 * 달력이 시트 뒤가 아니라 시트 "위"에 그대로 남아 계속 탭 가능해야(다른 날짜 선택 시
 * 시트 내용만 교체) 하기 때문에 화면 전체를 덮는 모달 구조를 쓸 수 없다. 닫힘은
 * 같은 날짜 재탭/이 시트 스와이프 다운/달력 영역 탭 세 가지 경로로 모두 부모
 * (`MonthView`)의 `onClose`를 호출하는 방식으로 통일. */
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
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const holiday = getHoliday(date);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    touchStartY.current = null;
    setDragging(false);
    if (dragY > SWIPE_CLOSE_THRESHOLD_PX) onClose();
    setDragY(0);
  };

  if (!mounted) return null;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTransitionEnd={() => {
        if (!open) setMounted(false);
      }}
      className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[52dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${
        dragging ? "" : "transition-transform duration-200"
      } ${open ? "translate-y-0" : "translate-y-full"}`}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <div className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-full bg-[#E8E6E0]" />

      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-ink">{formatHeader(date)}</span>
        {holiday && <span className="text-[12px] font-medium text-terra">{holiday}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-[var(--text-muted)]">주요 일정</span>
        {schedules.length === 0 ? (
          <GhostAddButton onClick={onAddSchedule} label="주요 일정 추가" />
        ) : (
          <SectionExpand
            items={schedules}
            pageSize={4}
            renderItem={(s, i) => (
              <button
                key={s.id}
                onClick={() => onOpenSchedule(s)}
                className={`flex flex-col gap-0.5 py-1.5 text-left ${
                  i > 0 ? "border-t border-border-light" : ""
                } ${s.id === highlightId ? "-mx-2 rounded-xl bg-honey/10 px-2" : ""}`}
              >
                <span
                  className={`truncate text-[12px] ${
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
            )}
          />
        )}
        {schedules.length === 0 && (
          <ActivitySuggestionSection
            workspaceId={workspaceId}
            selectedDate={date}
            suggestion={activitySuggestion}
            candidatePool={activityCandidates}
          />
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-border-light pt-3">
        <span className="text-[10px] font-medium text-[var(--text-muted)]">할 일</span>
        {todos.length === 0 ? (
          <GhostAddButton onClick={onAddTodo} label="할 일 추가" />
        ) : (
          todos.map((t) => (
            <TodoChecklistItem
              key={t.id}
              todo={t}
              onToggle={() => onToggleTodo(t)}
              onOpenEdit={() => onOpenTodoEdit(t)}
            />
          ))
        )}
      </div>

      {lastYearHighlights.length > 0 && (
        <div className="mt-4 flex flex-col gap-1 border-t border-border-light pt-3">
          <span className="text-[10px] tracking-[0.1em] text-[var(--text-muted)]">작년 이맘때</span>
          <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {lastYearHighlights.map((h, i) => (
              <span key={h.id}>
                {i > 0 && " · "}
                <button
                  onClick={() => onOpenLastYear(h)}
                  className="text-ink underline-offset-2 hover:underline"
                >
                  {h.title} {shortRange(h)}
                </button>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
