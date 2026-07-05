"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  supplies?: string | null;
  is_grocery: boolean;
  place?: string | null;
  amount?: number | null;
  receipt_image_url?: string | null;
}

export async function createSchedule(workspaceId: string, input: ScheduleInput) {
  const title = input.title.trim();
  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schedule, error } = await supabase
    .from("schedule")
    .insert({
      workspace_id: workspaceId,
      title,
      date_start: input.date_start,
      date_end: input.date_end || null,
      time_start: input.time_start || null,
      time_end: input.time_end || null,
      author_id: user!.id,
      target_members: input.target_members,
      is_shared: input.is_shared,
      keyword_main: input.keyword_main || null,
      keyword_sub: input.keyword_sub || null,
      is_important: input.is_important,
      memo: input.memo || null,
      supplies: input.supplies || null,
      is_grocery: input.is_grocery,
      place: input.place || null,
      amount: input.amount ?? null,
      receipt_image_url: input.receipt_image_url || null,
    })
    .select("id")
    .single();

  if (error || !schedule) {
    throw new Error(error?.message ?? "일정 등록에 실패했습니다.");
  }

  if (input.is_grocery && input.amount) {
    await supabase.from("expense").insert({
      workspace_id: workspaceId,
      category: "grocery",
      amount: input.amount,
      date: input.date_start,
      linked_schedule_id: schedule.id,
      created_by: user!.id,
    });
  }

  revalidatePath("/schedule");
  revalidatePath("/home");
  redirect(`/schedule?date=${input.date_start}`);
}

export async function deleteSchedule(scheduleId: string) {
  const supabase = await createClient();
  await supabase.from("schedule").delete().eq("id", scheduleId);
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

  await supabase.from("routine").upsert(
    {
      user_id: user!.id,
      day_of_week: dayOfWeek,
      semester,
      blocks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,day_of_week,semester" }
  );

  revalidatePath("/schedule/routine");
  revalidatePath("/home");
}
