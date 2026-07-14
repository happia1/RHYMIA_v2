"use client";

import { useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { getHoliday } from "@/lib/holidays";
import { solarToLunar } from "@/lib/lunar";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { isPeriodSchedule, shortRange } from "@/lib/scheduleFormat";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { TodoChecklistItem } from "@/components/schedule/TodoChecklistItem";
import { ActivitySuggestionSection } from "@/components/schedule/ActivitySuggestionSection";
import { SectionExpand } from "@/components/ui/SectionExpand";
import { useSwipeDownToClose } from "@/components/ui/useSwipeDownToClose";
import type { ExpandedSchedule } from "@/lib/recurrence";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];
// 사용자 요청으로 "오늘은 이런 건 어때요" 제안 섹션을 일단 숨김 — 다시 켤 땐 이 값만 true로.
const SHOW_ACTIVITY_SUGGESTION = false;

function formatHeaderParts(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const weekday = WEEKDAY_LABELS[(d.getUTCDay() + 6) % 7];
  const main = `${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${weekday}`;
  const lunar = solarToLunar(d);
  return { main, lunarLabel: lunar ? `음력 ${lunar.month}.${lunar.day}` : null };
}

function SectionHeader({ label, onAdd, addLabel }: { label: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-medium text-[var(--text-muted)]">{label}</span>
      <button onClick={onAdd} aria-label={addLabel} className="p-1 -m-1 text-[var(--text-muted)]">
        <IconPlus size={12} />
      </button>
    </div>
  );
}

/** 월간 뷰 "달력 주인공 + 호출형 하단 시트" — 날짜를 탭하면 달력 위에 압축된 채 함께
 * 떠 있는 하단 시트. 일반 모달(`BottomSheet`)과 달리 어두운 배경 오버레이가 없다 —
 * 달력이 시트 뒤가 아니라 시트 "위"에 그대로 남아 계속 탭 가능해야(다른 날짜 선택 시
 * 시트 내용만 교체) 하기 때문에 화면 전체를 덮는 모달 구조를 쓸 수 없다. 닫힘은
 * 같은 날짜 재탭/이 시트 스와이프 다운/달력 영역 탭 세 가지 경로로 모두 부모
 * (`MonthView`)의 `onClose`를 호출하는 방식으로 통일.
 *
 * 내부 순서: 기간 일정 컴팩트 바 → 주요 일정(하루짜리) → 할 일 → 작년 이맘때(있을 때만) →
 * 오늘은 이런 건 어때요(항상 맨 아래, 그날 일정 유무와 무관하게 노출). */
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
  const holiday = getHoliday(date);
  const { main, lunarLabel } = formatHeaderParts(date);
  const periodSchedules = schedules.filter(isPeriodSchedule);
  const singleDaySchedules = schedules.filter((s) => !isPeriodSchedule(s));

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
      className={`fixed inset-x-0 bottom-0 z-50 flex h-[62dvh] flex-col overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] ${
        dragging ? "" : "transition-transform duration-200"
      } ${open ? "translate-y-0" : "translate-y-full"}`}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <div className="mx-auto mb-3 h-1 w-9 shrink-0 rounded-full bg-[#E8E6E0]" />

      <div className="mb-3 flex items-baseline justify-between">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-medium text-ink">{main}</span>
          {lunarLabel && <span className="text-[11px] text-stone">{lunarLabel}</span>}
        </span>
        {holiday && <span className="text-[12px] font-medium text-terra">{holiday}</span>}
      </div>

      {/* 섹션 간 세로 간격은 전부 이 gap-4가 담당 — 예전엔 섹션마다 개별 mt-4를 달아서
          내용이 비어 있는 섹션 뒤의 간격이 서로 달라 보였다(주요 일정 뒤엔 공백이 있는데
          할 일 뒤엔 없는 식). 각 섹션은 자기 앞에 구분선이 필요하면 border-t pt-3만 갖고,
          "앞과의 거리"는 신경 쓰지 않는다. */}
      <div className="flex flex-col gap-4">
        {periodSchedules.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {periodSchedules.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpenSchedule(s)}
                className="flex items-center gap-1.5 text-left"
              >
                <span
                  className="h-[2px] w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: getKeywordColor(s.keyword_main) }}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink">
                  {s.title} <span className="text-stone">· {shortRange(s)}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <SectionHeader label="주요 일정" onAdd={onAddSchedule} addLabel="주요 일정 추가" />
          {singleDaySchedules.length > 0 && (
            <SectionExpand
              items={singleDaySchedules}
              pageSize={4}
              renderItem={(s, i) => (
                <button
                  key={s.id}
                  onClick={() => onOpenSchedule(s)}
                  className={`flex items-center justify-between gap-2 py-1.5 text-left ${
                    i > 0 ? "border-t border-border-light" : ""
                  } ${s.id === highlightId ? "-mx-2 rounded-xl bg-honey/10 px-2" : ""}`}
                >
                  <span
                    className={`min-w-0 flex-1 truncate text-[12px] ${
                      s.is_important ? "font-medium text-terra" : "text-ink"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="shrink-0 text-[9px] text-stone">
                    {s.time_start ? s.time_start.slice(0, 5) : "종일"} ·{" "}
                    {targetLabel(s.target_members, membersById)}
                  </span>
                </button>
              )}
            />
          )}
        </div>

        <div className="flex flex-col gap-1 border-t border-border-light pt-3">
          <SectionHeader label="할 일" onAdd={onAddTodo} addLabel="할 일 추가" />
          {todos.map((t) => (
            <TodoChecklistItem
              key={t.id}
              todo={t}
              onToggle={() => onToggleTodo(t)}
              onOpenEdit={() => onOpenTodoEdit(t)}
            />
          ))}
        </div>

        {lastYearHighlights.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-border-light pt-3">
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

        {/* 오늘은 이런 건 어때요 — 사용자 요청으로 일단 숨김(SHOW_ACTIVITY_SUGGESTION만 다시
            true로 돌리면 복원). */}
        {SHOW_ACTIVITY_SUGGESTION && (
          <ActivitySuggestionSection
            workspaceId={workspaceId}
            selectedDate={date}
            suggestion={activitySuggestion}
            candidatePool={activityCandidates}
          />
        )}
      </div>
    </div>
  );
}
