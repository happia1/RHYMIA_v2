"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!name || !displayName) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = crypto.randomUUID();
  const { error: workspaceError } = await supabase
    .from("family_workspace")
    .insert({ id: workspaceId, name });

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  const { error: memberError } = await supabase.from("workspace_member").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    role: "owner",
    display_name: displayName,
  });

  if (memberError) {
    throw new Error(memberError.message);
  }

  redirect("/home");
}

export async function joinWorkspace(workspaceId: string, displayName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("workspace_member").insert({
    workspace_id: workspaceId,
    user_id: user!.id,
    role: "member",
    display_name: displayName,
  });

  redirect("/home");
}
