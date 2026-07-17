"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { expandRecurring, addDaysToDateStr } from "@/lib/recurrence";
import type {
  NotifyOffset,
  RoutineBlock,
  RecurType,
  RecurCalendar,
  Schedule,
  Todo,
} from "@/types";

export interface ScheduleInput {
  title: string;
  date_start: string;
  date_end?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  target_members: string[];
  is_shared: boolean;
  keyword_main?: string | null;
  keyword_sub?: string | null;
  is_important: boolean;
  memo?: string | null;
  place?: string | null;
  amount?: number | null;
  is_all_day: boolean;
  notify_offset?: NotifyOffset | null;
  notify_custom_at?: string | null;
  /** 기본 'none' — weekly는 없음(루틴이 전담) */
  recur_type?: RecurType;
  /** recur_type이 'yearly'일 때만 의미 있음. 기본 'solar' */
  recur_calendar?: RecurCalendar;
  recur_until?: string | null;
}

export async function createSchedule(workspaceId: string, input: ScheduleInput) {
  const title = input.title.trim();
  if (!title) return { ok: false as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const scheduleId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("schedule")
    .insert({
      id: scheduleId,
      workspace_id: workspaceId,
      title,
      date_start: input.date_start,
      date_end: input.date_end || null,
      time_start: input.time_start || null,
      time_end: input.time_end || null,
      author_id: user.id,
      target_members: input.target_members,
      is_shared: input.is_shared,
      keyword_main: input.keyword_main || null,
      keyword_sub: input.keyword_sub || null,
      is_important: input.is_important,
      memo: input.memo || null,
      place: input.place || null,
      amount: input.amount ?? null,
      is_all_day: input.is_all_day,
      notify_offset: input.notify_offset || null,
      notify_custom_at: input.notify_custom_at || null,
      recur_type: input.recur_type ?? "none",
      recur_calendar: input.recur_calendar ?? "solar",
      recur_until: input.recur_until || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "일정 등록에 실패했습니다.");
  }

  revalidatePath("/schedule");
  revalidatePath("/home");
  // 홈의 낙관적 업데이트(HomeTodaySection)가 임시로 넣어둔 항목을 확정 데이터로 교체할 때 씀.
  return { ok: true as const, schedule: data as Schedule };
}

/** 월간/주간/연간 뷰가 쓰는 일정 조회 — 실제 저장된 행과 반복 일정(recur_type != 'none')의
 * 가상 인스턴스를 합쳐서 반환한다. Fridge에 올라오는 일정은 전부 가족 공유가 전제라
 * is_shared/author_id 기준 가시성 필터는 적용하지 않고 워크스페이스 안의 일정을 전부
 * 반환한다(스코프 구분 제거 — 컬럼 자체는 유지, 조회 조건에서만 뺌).
 *
 * "겹침" 기준 조회: 시작일이 범위 안에 있는지만 보면(gte/lte date_start) 전월에 시작해
 * 이번 달로 이어지는 기간 일정(방학 등)이 빠진다. 그래서 date_start <= rangeEnd AND
 * (date_end >= rangeStart OR (date_end가 없고 date_start >= rangeStart))로 바꿨다.
 * 반복 전개도 같은 문제가 있어 — expandRecurring을 rangeStart보다 31일 앞선 시점부터
 * 돌려서(그 안에서 시작해 범위 안으로 이어지는 인스턴스도 만들어지게) 생성한 뒤,
 * 실제 범위와 겹치는(date_end 포함) 것만 남긴다. */
export async function getSchedulesForRange(
  workspaceId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Schedule[]> {
  const supabase = await createClient();

  const [rangeResult, recurringResult] = await Promise.all([
    supabase
      .from("schedule")
      .select("*")
      .eq("workspace_id", workspaceId)
      .lte("date_start", rangeEnd)
      .or(`date_end.gte.${rangeStart},and(date_end.is.null,date_start.gte.${rangeStart})`)
      .order("date_start", { ascending: true }),
    supabase
      .from("schedule")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("recur_type", "none")
      .lte("date_start", rangeEnd)
      .or(`recur_until.is.null,recur_until.gte.${rangeStart}`),
  ]);

  if (rangeResult.error) throw new Error(rangeResult.error.message);
  if (recurringResult.error) throw new Error(recurringResult.error.message);

  const expandFrom = addDaysToDateStr(rangeStart, -31);
  const virtualCandidates = expandRecurring(
    (recurringResult.data ?? []) as Schedule[],
    expandFrom,
    rangeEnd
  );
  const virtual = virtualCandidates.filter((v) => {
    const end = v.date_end ?? v.date_start;
    return v.date_start <= rangeEnd && end >= rangeStart;
  });

  const merged = [...((rangeResult.data ?? []) as Schedule[]), ...virtual];
  merged.sort((a, b) => (a.date_start < b.date_start ? -1 : a.date_start > b.date_start ? 1 : 0));

  return merged;
}

/** 월간 뷰 하단 "작년 이맘때" — 전년도 같은 달의 일정 중 반복 원본(recur_type != 'none')은
 * 제외한다(반복 원본은 이미 올해도 자동으로 나타나므로 다시 등록하라고 제안할 필요가 없음).
 * 기간 일정과 키워드가 있는 일정을 우선 보여주고 최대 5건. 전년도에 해당 달 일정이
 * 없으면 빈 배열 — 호출부가 섹션 자체를 렌더하지 않는다. */
export async function getLastYearHighlights(
  workspaceId: string,
  year: number,
  month: number
): Promise<Schedule[]> {
  const supabase = await createClient();
  const lastYear = year - 1;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${lastYear}-${pad2(month + 1)}-01`;
  const daysInMonth = new Date(lastYear, month + 1, 0).getDate();
  const monthEnd = `${lastYear}-${pad2(month + 1)}-${pad2(daysInMonth)}`;

  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("recur_type", "none")
    .gte("date_start", monthStart)
    .lte("date_start", monthEnd)
    .order("date_start", { ascending: true });

  if (error) throw new Error(error.message);

  const schedules = (data ?? []) as Schedule[];
  const score = (s: Schedule) => (s.date_end && s.date_end !== s.date_start ? 1 : 0) + (s.keyword_main ? 1 : 0);
  return schedules
    .slice()
    .sort((a, b) => score(b) - score(a) || (a.date_start < b.date_start ? -1 : 1))
    .slice(0, 5);
}

export async function updateSchedule(scheduleId: string, input: ScheduleInput) {
  const title = input.title.trim();
  if (!title) return { ok: false as const, message: "제목을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schedule, error: fetchError } = await supabase
    .from("schedule")
    .select("author_id")
    .eq("id", scheduleId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!schedule || schedule.author_id !== user.id) {
    return { ok: false as const, message: "수정 권한이 없습니다." };
  }

  const { error } = await supabase
    .from("schedule")
    .update({
      title,
      date_start: input.date_start,
      date_end: input.date_end || null,
      time_start: input.time_start || null,
      time_end: input.time_end || null,
      target_members: input.target_members,
      is_shared: input.is_shared,
      keyword_main: input.keyword_main || null,
      keyword_sub: input.keyword_sub || null,
      is_important: input.is_important,
      memo: input.memo || null,
      place: input.place || null,
      amount: input.amount ?? null,
      is_all_day: input.is_all_day,
      notify_offset: input.notify_offset || null,
      notify_custom_at: input.notify_custom_at || null,
      recur_type: input.recur_type ?? "none",
      recur_calendar: input.recur_calendar ?? "solar",
      recur_until: input.recur_until || null,
    })
    .eq("id", scheduleId);

  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function deleteSchedule(scheduleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schedule, error: fetchError } = await supabase
    .from("schedule")
    .select("author_id")
    .eq("id", scheduleId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!schedule || schedule.author_id !== user.id) {
    return { ok: false as const, message: "삭제 권한이 없습니다." };
  }

  const { error } = await supabase.from("schedule").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function upsertRoutine(
  memberId: string,
  dayOfWeek: number,
  semester: string,
  blocks: unknown
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS(can_write_routine)가 본인 루틴 또는 같은 워크스페이스 managed 멤버 루틴만 허용
  const { error } = await supabase.from("routine").upsert(
    {
      member_id: memberId,
      day_of_week: dayOfWeek,
      semester,
      blocks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id,day_of_week,semester" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
}

/** 일정 탭 "하루" 뷰의 루틴 사용 여부 토글 (멤버별). RLS(member_update)가 본인/관리 멤버만 허용.
 * 2026-07-12부터 /schedule/routine 페이지가 없어지고 하루 뷰로 흡수됨. */
export async function updateRoutineEnabled(memberId: string, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("workspace_member")
    .update({ routine_enabled: enabled })
    .eq("id", memberId);

  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
}

/** 에이전트 루틴 카드가 겹침 확인/병합을 위해 특정 멤버의 요일별 기존 블록을 조회할 때 사용. */
export async function getRoutineBlocks(
  memberId: string,
  days: number[],
  semester = "default"
): Promise<Record<number, RoutineBlock[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!memberId || days.length === 0) return {};

  // RLS(can_read_routine)가 본인 루틴 또는 같은 워크스페이스 managed 멤버 루틴만 허용
  const { data, error } = await supabase
    .from("routine")
    .select("day_of_week, blocks")
    .eq("member_id", memberId)
    .eq("semester", semester)
    .in("day_of_week", days);

  if (error) throw new Error(error.message);

  const result: Record<number, RoutineBlock[]> = {};
  for (const row of data ?? []) {
    result[row.day_of_week] = (row.blocks as RoutineBlock[]) ?? [];
  }
  return result;
}

export interface TodoInput {
  title: string;
  due_date: string | null;
  description: string | null;
  notify_enabled: boolean;
  repeat_type: string | null;
  tag: string | null;
  color: string;
}

export async function createTodo(workspaceId: string, input: TodoInput) {
  const title = input.title.trim();
  if (!title) return { ok: false as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("todo")
    .insert({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      author_id: user.id,
      title,
      due_date: input.due_date,
      description: input.description,
      notify_enabled: input.notify_enabled,
      repeat_type: input.repeat_type,
      tag: input.tag,
      color: input.color,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "할 일 등록에 실패했습니다.");
  }

  revalidatePath("/schedule");
  // 예전엔 /home이 빠져 있었음 — 홈의 "오늘 뭐하지"도 due_date=오늘인 할 일을 직접 조회하므로
  // 여기서도 무효화해야 낙관적 업데이트 이후의 자연스러운 재방문에서 캐시가 안 어긋난다.
  revalidatePath("/home");
  // 홈의 낙관적 업데이트(HomeTodaySection)가 임시로 넣어둔 항목을 확정 데이터로 교체할 때 씀.
  return { ok: true as const, todo: data as Todo };
}

/** 월간 뷰의 선택일 패널이 그 달 범위 안의 할 일을 "등록된(= due_date가 그 날인)" 날짜에
 * 표시하기 위한 조회. due_date가 null인 할 일은 애초에 달력에 놓일 날짜가 없어 범위 비교에서
 * 자연히 빠진다(Postgres에서 NULL 비교는 항상 false). */
export async function getTodosForRange(
  workspaceId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Todo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todo")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("due_date", rangeStart)
    .lte("due_date", rangeEnd)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Todo[];
}

/** 오늘 날짜 패널에서만 쓰는 "지난 할 일" 이월 목록 — 마감일이 지났는데 아직 완료 안 한
 * 할 일. 무한정 쌓이는 걸 막기 위해 50건으로 방어적으로 제한(스펙엔 없지만 안전장치). */
export async function getOverdueTodos(workspaceId: string, todayStr: string): Promise<Todo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todo")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_done", false)
    .lt("due_date", todayStr)
    .order("due_date", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as Todo[];
}

/** 할 일 완료 토글 — RLS(workspace_access)가 워크스페이스 멤버 전체를 허용해서(장보기 항목
 * 체크와 동일한 성격) 작성자 제한을 두지 않는다. 호출부(MonthView/TodayEvents)가 먼저
 * 낙관적으로 UI를 바꾼 뒤 이 액션을 호출한다. */
export async function toggleTodoDone(todoId: string, done: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("todo").update({ is_done: done }).eq("id", todoId);
  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
}

/** 할 일 수정(제목·마감일·설명 등 전체 필드) — 월간·주간 뷰의 할 일 수정 시트(TodoSheet)가
 * 공유하는 단일 액션. toggleTodoDone과 같은 이유로 작성자 제한 없음(가족 전체가 편집 가능).
 * is_done은 여기서 건드리지 않는다(완료 토글은 별도 toggleTodoDone 경로). */
export async function updateTodo(todoId: string, input: TodoInput) {
  const title = input.title.trim();
  if (!title) return { ok: false as const, message: "제목을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("todo")
    .update({
      title,
      due_date: input.due_date,
      description: input.description,
      notify_enabled: input.notify_enabled,
      repeat_type: input.repeat_type,
      tag: input.tag,
      color: input.color,
    })
    .eq("id", todoId);
  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function deleteTodo(todoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("todo").delete().eq("id", todoId);
  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
}
