"use client";

import { IconPlus } from "@tabler/icons-react";
import { toDateStr } from "@/lib/date";
import { getHoliday } from "@/lib/holidays";
import { solarToLunar } from "@/lib/lunar";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { isPeriodSchedule, shortRange } from "@/lib/scheduleFormat";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { TodoChecklistItem } from "@/components/schedule/TodoChecklistItem";
import { EventMarker } from "@/components/schedule/EventMarker";
import { PeriodBarRow } from "@/components/schedule/PeriodBarRow";
import { ActivitySuggestionSection } from "@/components/schedule/ActivitySuggestionSection";
import { SectionExpand } from "@/components/ui/SectionExpand";
import type { ExpandedSchedule } from "@/lib/recurrence";
import type { Todo } from "@/types";

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function formatHeaderParts(date: string) {
  const d = new Date(`${date}T00:00:00.000Z`);
  const weekday = WEEKDAY_LABELS[(d.getUTCDay() + 6) % 7];
  const main = `${d.getUTCMonth() + 1}. ${d.getUTCDate()}. ${weekday}`;
  const lunar = solarToLunar(d);
  return { main, lunarLabel: lunar ? `음력 ${lunar.month}.${lunar.day}` : null };
}

// 토요일 ocean(파랑 계열), 일요일·공휴일 terra(빨강 계열) — 월간 달력과 같은 규칙(저채도,
// 기존 브랜드 톤 재사용)을 데이 시트 헤더 날짜에도 그대로 적용.
function weekendColorClass(date: string, holiday: string | null) {
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (holiday || dow === 0) return "text-terra";
  if (dow === 6) return "text-ocean";
  return null;
}

function SectionHeader({ label, onAdd, addLabel }: { label: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-medium text-[var(--text-muted)]">{label}</span>
      <button onClick={onAdd} aria-label={addLabel} className="p-1 -m-1 text-[var(--text-muted)]">
        <IconPlus size={12} />
      </button>
    </div>
  );
}

/** 선택일 상세 콘텐츠 — 날짜 헤더(+음력/공휴일) → 기간 바 → 주요 일정 → 할 일 → 작년
 * 이맘때 → (showActivitySuggestion일 때만) 오늘은 이런 건 어때요. 모바일 DaySheet(하단
 * 슬라이드 시트)와 태블릿 월간 뷰의 고정 우측 패널 양쪽이 이 컴포넌트 하나를 그대로
 * 공유한다 — 마커·+·수정 문법이 완전히 동일, 바깥 컨테이너(슬라이드 여부/배경/패딩)만
 * 다르다. */
export function DaySheetContent({
  date,
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
  showActivitySuggestion = false,
  emphasizeToday = false,
}: {
  date: string;
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
  /** 태블릿 월간 뷰 우측 패널에서만 true — 모바일 데이 시트는 사용자 요청으로 계속 숨김
   * (DaySheet.tsx 쪽 기본값 유지, 여기서는 호출부가 명시적으로 켜야만 노출). */
  showActivitySuggestion?: boolean;
  /** 태블릿 우측 패널이 날짜 미선택 기본 상태(오늘)를 보여줄 때만 true — 헤더에 "오늘"을
   * 덧붙인다. 모바일 데이 시트는 항상 명시적으로 탭해서 여는 화면이라 대상이 아니다. */
  emphasizeToday?: boolean;
}) {
  const holiday = getHoliday(date);
  const { main, lunarLabel } = formatHeaderParts(date);
  const dateColorClass = weekendColorClass(date, holiday);
  const isToday = emphasizeToday && date === toDateStr(new Date());
  const periodSchedules = schedules.filter(isPeriodSchedule);
  const singleDaySchedules = schedules.filter((s) => !isPeriodSchedule(s));

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="flex items-baseline gap-1.5">
          {isToday && <span className="text-[18px] font-medium text-honey">오늘 ·</span>}
          <span className={`text-[18px] font-medium ${dateColorClass ?? "text-ink"}`}>{main}</span>
          {lunarLabel && <span className="text-[13px] text-stone">{lunarLabel}</span>}
        </span>
        {holiday && <span className="text-[14px] font-medium text-terra">{holiday}</span>}
      </div>

      {/* 섹션 간 세로 간격은 전부 이 gap-4가 담당 — 예전엔 섹션마다 개별 mt-4를 달아서
          내용이 비어 있는 섹션 뒤의 간격이 서로 달라 보였다(주요 일정 뒤엔 공백이 있는데
          할 일 뒤엔 없는 식). 각 섹션은 자기 앞에 구분선이 필요하면 border-t pt-3만 갖고,
          "앞과의 거리"는 신경 쓰지 않는다. */}
      <div className="flex flex-col gap-4">
        {periodSchedules.length > 0 && (
          <div className="flex flex-col gap-3">
            {periodSchedules.map((s) => (
              <div key={s.id} className="flex items-stretch gap-2">
                <span className="w-8 shrink-0 pt-0.5 text-[11px] text-stone">종일</span>
                <div className="min-w-0 flex-1">
                  <PeriodBarRow schedule={s} onClick={() => onOpenSchedule(s)} />
                </div>
              </div>
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
                  className={`flex items-center gap-2 py-1.5 text-left ${
                    i > 0 ? "border-t border-border-light" : ""
                  } ${s.id === highlightId ? "-mx-2 rounded-xl bg-honey/10 px-2" : ""}`}
                >
                  <EventMarker type="dot" color={getKeywordColor(s.keyword_main)} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[14px] ${
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
            <span className="text-[12px] tracking-[0.1em] text-[var(--text-muted)]">작년 이맘때</span>
            <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
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

        {showActivitySuggestion && (
          <ActivitySuggestionSection
            workspaceId={workspaceId}
            selectedDate={date}
            suggestion={activitySuggestion}
            candidatePool={activityCandidates}
          />
        )}
      </div>
    </>
  );
}
