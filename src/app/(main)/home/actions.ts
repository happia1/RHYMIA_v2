"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addShoppingItem(workspaceId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("shopping_item")
    .insert({ workspace_id: workspaceId, name: trimmed, added_by: user.id });

  revalidatePath("/home");
}

export async function toggleShoppingPurchased(itemId: string, purchased: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("shopping_item")
    .update({
      is_purchased: purchased,
      purchased_at: purchased ? new Date().toISOString() : null,
      purchased_by: purchased ? user.id : null,
    })
    .eq("id", itemId);

  revalidatePath("/home");
}

export async function deleteShoppingItem(itemId: string) {
  const supabase = await createClient();
  await supabase.from("shopping_item").delete().eq("id", itemId);
  revalidatePath("/home");
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

  await supabase
    .from("meal_participation")
    .upsert(
      { meal_id: mealId, user_id: user.id, status: nextStatus },
      { onConflict: "meal_id,user_id" }
    );

  revalidatePath("/home");
  revalidatePath("/food");
}

export async function addNotice(
  workspaceId: string,
  input: {
    type: "sticky" | "memo" | "notice";
    title?: string;
    content: string;
    color?: string;
    isPinned?: boolean;
    expireDays?: number;
  }
) {
  const content = input.content.trim();
  if (!content) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const expireAt =
    input.type === "sticky" && input.expireDays
      ? new Date(Date.now() + input.expireDays * 86400000).toISOString()
      : null;

  await supabase.from("notice").insert({
    workspace_id: workspaceId,
    type: input.type,
    title: input.title?.trim() || null,
    content,
    color: input.color ?? "#FFF9C4",
    is_pinned: input.isPinned ?? false,
    expire_at: expireAt,
    created_by: user.id,
  });

  revalidatePath("/home");
}

export async function deleteNotice(noticeId: string) {
  const supabase = await createClient();
  await supabase.from("notice").delete().eq("id", noticeId);
  revalidatePath("/home");
}
