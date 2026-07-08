"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HabitRepeatType, NotifyOffset } from "@/types";

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
    throw new Error("삭제 권한이 없습니다.");
  }

  const { error } = await supabase.from("schedule").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);

  revalidatePath("/schedule");
  revalidatePath("/home");
}

export async function upsertRoutine(
  dayOfWeek: number,
  semester: string,
  blocks: unknown
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("routine").upsert(
    {
      user_id: user!.id,
      day_of_week: dayOfWeek,
      semester,
      blocks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,day_of_week,semester" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/schedule/routine");
  revalidatePath("/home");
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
