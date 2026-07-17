"use client";

import { useEffect, useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { TodayEvents } from "@/components/home/TodayEvents";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { TodoSheet } from "@/components/schedule/TodoSheet";
import { AddTemplatePicker, type TemplateType } from "@/components/schedule/AddTemplatePicker";
import { useToast } from "@/components/ui/Toast";
import { toggleTodoDone, type ScheduleInput, type TodoInput } from "@/app/(main)/schedule/actions";
import type { Schedule, Todo } from "@/types";

export function HomeTodaySection({
  todaySchedules,
  todayTodos,
  overdueTodos,
  members,
  workspaceId,
  defaultDate,
  currentUserId,
}: {
  todaySchedules: Schedule[];
  todayTodos: Todo[];
  overdueTodos: Todo[];
  members: { id: string; display_name: string }[];
  workspaceId: string;
  defaultDate: string;
  currentUserId: string;
}) {
  const { showToast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<TemplateType | null>(null);

  // 서버 컴포넌트(홈 page.tsx)가 최초 렌더에 딱 한 번 내려주는 props를 로컬 상태로 복제해
  // 두고, 등록 낙관적 업데이트는 이 로컬 상태에만 반영한다 — 홈 위젯 전체가 서버 컴포넌트
  // 직조회 구조라 이 섹션만 클라이언트 상태로 감싸는 최소 리팩터(요구사항 2). props가 실제로
  // 바뀌면(다른 서버 액션의 revalidatePath로 페이지가 다시 렌더될 때) 로컬 상태도 다시 맞춘다.
  const [schedules, setSchedules] = useState(todaySchedules);
  const [todos, setTodos] = useState(todayTodos);
  const [overdue, setOverdue] = useState(overdueTodos);
  useEffect(() => setSchedules(todaySchedules), [todaySchedules]);
  useEffect(() => setTodos(todayTodos), [todayTodos]);
  useEffect(() => setOverdue(overdueTodos), [overdueTodos]);

  const handleSelect = (type: TemplateType) => {
    setPickerOpen(false);
    setActiveSheet(type);
  };

  const handleToggleTodo = (todo: Todo, isOverdue: boolean) => {
    const next = !todo.is_done;
    const setter = isOverdue ? setOverdue : setTodos;
    setter((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: next } : t)));
    toggleTodoDone(todo.id, next).catch(() => {
      setter((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_done: !next } : t)));
    });
  };

  // 오늘 위젯이라 due_date/date_start가 오늘이 아닌 등록은 로컬에 끼워넣지 않는다(예: 할 일
  // 시트에서 "내일"을 고른 경우) — 어차피 다른 날짜라 이 목록엔 안 보여야 정상이고, 그대로
  // 두면 서버 확정 데이터로 교체하는 시점에 오늘 목록에 남의 날짜 항목이 끼는 문제가 생긴다.
  const handleOptimisticTodo = (tempId: string, input: TodoInput) => {
    if (input.due_date !== defaultDate) return;
    const optimistic: Todo = {
      id: tempId,
      workspace_id: workspaceId,
      author_id: currentUserId,
      title: input.title,
      due_date: input.due_date,
      description: input.description,
      notify_enabled: input.notify_enabled,
      repeat_type: input.repeat_type,
      tag: input.tag,
      color: input.color,
      is_done: false,
      created_at: new Date().toISOString(),
    };
    setTodos((prev) => [...prev, optimistic]);
  };

  const handleTodoSettled = (
    tempId: string,
    result: { ok: true; todo: Todo } | { ok: false }
  ) => {
    setTodos((prev) => {
      const withoutTemp = prev.filter((t) => t.id !== tempId);
      return result.ok ? [...withoutTemp, result.todo] : withoutTemp;
    });
    if (!result.ok) showToast("할 일 등록에 실패했어요.");
  };

  const handleOptimisticSchedule = (tempId: string, input: ScheduleInput) => {
    if (input.date_start !== defaultDate) return;
    const optimistic: Schedule = {
      id: tempId,
      workspace_id: workspaceId,
      title: input.title,
      date_start: input.date_start,
      date_end: input.date_end ?? null,
      time_start: input.time_start ?? null,
      time_end: input.time_end ?? null,
      author_id: currentUserId,
      target_members: input.target_members,
      is_shared: input.is_shared,
      keyword_main: input.keyword_main ?? null,
      keyword_sub: input.keyword_sub ?? null,
      is_important: input.is_important,
      memo: input.memo ?? null,
      supplies: null,
      is_grocery: false,
      place: input.place ?? null,
      amount: input.amount ?? null,
      receipt_image_url: null,
      is_all_day: input.is_all_day,
      image_url: null,
      notify_offset: input.notify_offset ?? null,
      notify_custom_at: input.notify_custom_at ?? null,
      created_at: new Date().toISOString(),
      recur_type: input.recur_type ?? "none",
      recur_calendar: input.recur_calendar ?? "solar",
      recur_until: input.recur_until ?? null,
    };
    setSchedules((prev) => [...prev, optimistic]);
  };

  const handleScheduleSettled = (
    tempId: string,
    result: { ok: true; schedule: Schedule } | { ok: false }
  ) => {
    setSchedules((prev) => {
      const withoutTemp = prev.filter((s) => s.id !== tempId);
      return result.ok ? [...withoutTemp, result.schedule] : withoutTemp;
    });
    if (!result.ok) showToast("일정 등록에 실패했어요.");
  };

  return (
    <section className="flex flex-col gap-1.5">
      <SectionLabel icon={<IconCalendar size={14} />} onAdd={() => setPickerOpen(true)} addLabel="일정 등록">
        오늘 뭐하지
      </SectionLabel>
      <div className="pl-section-indent">
        <TodayEvents
          todaySchedules={schedules}
          todos={todos}
          overdueTodos={overdue}
          onToggleTodo={handleToggleTodo}
        />
      </div>

      <AddTemplatePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelect} />

      <TodoSheet
        open={activeSheet === "todo"}
        onClose={() => setActiveSheet(null)}
        workspaceId={workspaceId}
        onOptimisticCreate={handleOptimisticTodo}
        onCreateSettled={handleTodoSettled}
      />
      <AddEventSheet
        open={activeSheet === "event"}
        onClose={() => setActiveSheet(null)}
        workspaceId={workspaceId}
        members={members}
        defaultDate={defaultDate}
        onOptimisticCreate={handleOptimisticSchedule}
        onCreateSettled={handleScheduleSettled}
      />
    </section>
  );
}
