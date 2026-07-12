"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { expandRecurring } from "@/lib/recurrence";
import type {
  HabitRepeatType,
  NotifyOffset,
  RoutineBlock,
  RecurType,
  RecurCalendar,
  Schedule,
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
  is_grocery: boolean;
  place?: string | null;
  amount?: number | null;
  receipt_image_url?: string | null;
  is_all_day: boolean;
  image_url?: string | null;
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
  const { error } = await supabase.from("schedule").insert({
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
    is_grocery: input.is_grocery,
    place: input.place || null,
    amount: input.amount ?? null,
    receipt_image_url: input.receipt_image_url || null,
    is_all_day: input.is_all_day,
    image_url: input.image_url || null,
    notify_offset: input.notify_offset || null,
    notify_custom_at: input.notify_custom_at || null,
    recur_type: input.recur_type ?? "none",
    recur_calendar: input.recur_calendar ?? "solar",
    recur_until: input.recur_until || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (input.is_grocery && input.amount) {
    const { error: expenseError } = await supabase.from("expense").insert({
      workspace_id: workspaceId,
      category: "grocery",
      amount: input.amount,
      date: input.date_start,
      linked_schedule_id: scheduleId,
      created_by: user.id,
    });
    if (expenseError) throw new Error(expenseError.message);
  }

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
}

/** 월간/주간/연간 뷰가 쓰는 일정 조회 — 실제 저장된 행(범위 내 date_start)과
 * 반복 일정(recur_type != 'none')의 가상 인스턴스를 합쳐서 반환한다.
 * 두 조회 모두 기존과 동일한 "공유거나 내가 만든 것만" 가시성 규칙을 적용한다
 * (RLS의 schedule_select는 워크스페이스 멤버 전체에게 열려 있어, 이 앱에서는
 * 비공개 일정 숨김을 여기 애플리케이션 코드가 담당함 — schedule/page.tsx가
 * 하던 인라인 쿼리를 그대로 옮기고 반복 인스턴스만 추가한 것). */
export async function getSchedulesForRange(
  workspaceId: string,
  userId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<Schedule[]> {
  const supabase = await createClient();

  const [rangeResult, recurringResult] = await Promise.all([
    supabase
      .from("schedule")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("date_start", rangeStart)
      .lte("date_start", rangeEnd)
      .or(`is_shared.eq.true,author_id.eq.${userId}`)
      .order("date_start", { ascending: true }),
    supabase
      .from("schedule")
      .select("*")
      .eq("workspace_id", workspaceId)
      .neq("recur_type", "none")
      .lte("date_start", rangeEnd)
      .or(`recur_until.is.null,recur_until.gte.${rangeStart}`)
      .or(`is_shared.eq.true,author_id.eq.${userId}`),
  ]);

  if (rangeResult.error) throw new Error(rangeResult.error.message);
  if (recurringResult.error) throw new Error(recurringResult.error.message);

  const virtual = expandRecurring((recurringResult.data ?? []) as Schedule[], rangeStart, rangeEnd);

  const merged = [...((rangeResult.data ?? []) as Schedule[]), ...virtual];
  merged.sort((a, b) => (a.date_start < b.date_start ? -1 : a.date_start > b.date_start ? 1 : 0));

  return merged;
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

  revalidatePath("/schedule/routine");
  revalidatePath("/home");
}

/** 일정 탭 상단 "내 루틴" 위젯 표시 여부 토글 (멤버별). RLS(member_update)가 본인/관리 멤버만 허용. */
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
  revalidatePath("/schedule/routine");
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

export interface DiaryInput {
  date: string;
  day_of_week: number;
  weather: string | null;
  mood: string | null;
  photo_url: string | null;
  content: string | null;
}

export async function createDiary(workspaceId: string, input: DiaryInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("diary").insert({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    author_id: user.id,
    date: input.date,
    day_of_week: input.day_of_week,
    weather: input.weather,
    mood: input.mood,
    photo_url: input.photo_url,
    content: input.content,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/schedule");
  return { ok: true as const };
}

export interface HabitInput {
  name: string;
  start_time: string | null;
  repeat_type: HabitRepeatType;
  repeat_days: number[];
  target_duration: string | null;
  notify_enabled: boolean;
  notify_time: string | null;
}

export async function createHabit(input: HabitInput) {
  const name = input.name.trim();
  if (!name) return { ok: false as const };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("habit").insert({
    id: crypto.randomUUID(),
    user_id: user.id,
    name,
    start_time: input.start_time,
    repeat_type: input.repeat_type,
    repeat_days: input.repeat_days,
    target_duration: input.target_duration,
    notify_enabled: input.notify_enabled,
    notify_time: input.notify_time,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/schedule");
  revalidatePath("/home");
  return { ok: true as const };
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

  const { error } = await supabase.from("todo").insert({
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
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/schedule");
  return { ok: true as const };
}
