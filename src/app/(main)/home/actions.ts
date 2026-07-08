"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { HOME_SECTION_IDS, type HomeSectionId } from "@/lib/homeLayout";

export async function addShoppingItem(workspaceId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("shopping_item")
    .insert({ workspace_id: workspaceId, name: trimmed, added_by: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/board");
}

export async function toggleShoppingPurchased(itemId: string, purchased: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("shopping_item")
    .update({
      is_purchased: purchased,
      purchased_at: purchased ? new Date().toISOString() : null,
      purchased_by: purchased ? user.id : null,
    })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/board");
}

export async function deleteShoppingItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("shopping_item").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/home");
  revalidatePath("/board");
}

export async function toggleMealParticipation(
  mealId: string,
  currentStatus: boolean | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const nextStatus = currentStatus !== true;

  const { error } = await supabase
    .from("meal_participation")
    .upsert(
      { meal_id: mealId, user_id: user.id, status: nextStatus },
      { onConflict: "meal_id,user_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/food");
}

export async function updateHomeLayout(order: HomeSectionId[]) {
  const validOrder = order.filter((id) => HOME_SECTION_IDS.includes(id));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { error } = await supabase
    .from("users")
    .update({ home_layout: validOrder })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/home");
}
