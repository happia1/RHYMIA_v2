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

  await supabase.from("users").update({ avatar_image_url: url }).eq("id", user.id);

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
