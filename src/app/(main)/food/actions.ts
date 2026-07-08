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
    throw new Error("수정 권한이 없습니다.");
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
    })
    .eq("id", mealId);

  if (error) throw new Error(error.message);

  revalidatePath("/food");
  revalidatePath(`/food/${mealId}`);
  redirect(`/food/${mealId}`);
}

export async function toggleMealLike(mealId: string, liked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (liked) {
    const { error } = await supabase
      .from("meal_like")
      .insert({ meal_id: mealId, user_id: user.id });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("meal_like")
      .delete()
      .eq("meal_id", mealId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/food");
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
