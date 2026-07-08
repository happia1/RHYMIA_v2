"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function setAvatarImageUrl(url: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ avatar_image_url: url })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/settings");
  revalidatePath("/food");
}

export async function updateAvatarImage(imageUrl: string) {
  await setAvatarImageUrl(imageUrl);
}

export async function clearAvatarImage() {
  await setAvatarImageUrl(null);
}

export async function regenerateShareToken(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership || membership.role !== "owner") {
    throw new Error("공유 링크는 오너만 재발급할 수 있습니다.");
  }

  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from("family_workspace")
    .update({ share_token: newToken })
    .eq("id", workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  return { shareToken: newToken };
}
