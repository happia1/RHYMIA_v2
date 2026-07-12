"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FridgeCategory, MealType } from "@/types";

export interface MealInput {
  date: string;
  tag: string;
  type: MealType;
  main_menu: string;
  sides: string[];
  place?: string | null;
  reservation_time?: string | null;
  memo?: string | null;
  emoji?: string;
  image_url?: string | null;
}

export async function createMeal(workspaceId: string, input: MealInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("meal")
    .insert({
      workspace_id: workspaceId,
      date: input.date,
      tag: input.tag,
      type: input.type,
      main_menu: input.main_menu,
      sides: input.sides,
      place: input.place ?? null,
      reservation_time: input.reservation_time ?? null,
      memo: input.memo ?? null,
      emoji: input.emoji ?? "🍽",
      image_url: input.image_url ?? null,
      author_id: user!.id,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "끼니 등록에 실패했습니다.");

  revalidatePath("/food");
  revalidatePath("/home");
  redirect(`/food?date=${input.date}`);
}

export async function updateMeal(mealId: string, input: MealInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meal, error: fetchError } = await supabase
    .from("meal")
    .select("author_id")
    .eq("id", mealId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!meal || meal.author_id !== user.id) {
    return { ok: false as const, message: "수정 권한이 없습니다." };
  }

  const { error } = await supabase
    .from("meal")
    .update({
      date: input.date,
      tag: input.tag,
      type: input.type,
      main_menu: input.main_menu,
      sides: input.sides,
      place: input.place ?? null,
      reservation_time: input.reservation_time ?? null,
      memo: input.memo ?? null,
      image_url: input.image_url ?? null,
    })
    .eq("id", mealId);

  if (error) throw new Error(error.message);

  revalidatePath("/food");
  revalidatePath(`/food/${mealId}`);
  redirect(`/food/${mealId}`);
}

export async function addFridgeItem(
  workspaceId: string,
  name: string,
  category: FridgeCategory
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("fridge_item")
    .insert({ workspace_id: workspaceId, name: trimmed, category, added_by: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/food/add");
}

export async function deleteFridgeItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fridge_item").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/food/add");
}

/** "늘 먹던 메뉴" 콜드스타트 판정용 — 서로 다른 날짜 기준 끼니 기록 일수를 센다.
 * meal.date에 유니크 인덱스가 없어 count distinct를 SQL로 직접 못 미뤄서, date 컬럼만
 * 가져와 앱 코드에서 Set으로 중복 제거한다(기록이 많아져도 date는 짧은 문자열이라 부담 적음). */
export async function getMealTrackingDayCount(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal")
    .select("date")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((m) => m.date)).size;
}

export async function createMealVote(workspaceId: string, date: string, candidates: string[]) {
  const trimmed = candidates.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length < 2) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("meal_vote").insert({
    workspace_id: workspaceId,
    date,
    candidates: trimmed,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/food");
}

export async function castMealVoteBallot(voteId: string, candidateIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("meal_vote_ballot")
    .upsert(
      { vote_id: voteId, user_id: user.id, candidate_index: candidateIndex },
      { onConflict: "vote_id,user_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/home");
}

/** 마감 시각을 정해두고 자동으로 닫는 백그라운드 잡이 없어, 가족 중 누구나 이 액션으로
 * 수동 마감하면 그 시점의 최다득표 메뉴를 등록 제안 카드로 보여주는 방식으로 대체한다. */
export async function closeMealVote(voteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_vote").update({ is_closed: true }).eq("id", voteId);
  if (error) throw new Error(error.message);
  revalidatePath("/home");
}

export async function deleteMealVote(voteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_vote").delete().eq("id", voteId);
  if (error) throw new Error(error.message);
  revalidatePath("/home");
}

export async function addMealComment(mealId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("meal_comment")
    .insert({ meal_id: mealId, user_id: user.id, content: trimmed });

  if (error) throw new Error(error.message);

  revalidatePath("/food");
}
