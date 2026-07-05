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

  const { data: workspace, error } = await supabase
    .from("family_workspace")
    .insert({ name })
    .select("id")
    .single();

  if (error || !workspace) {
    throw new Error(error?.message ?? "워크스페이스 생성에 실패했습니다.");
  }

  await supabase.from("workspace_member").insert({
    workspace_id: workspace.id,
    user_id: user!.id,
    role: "owner",
    display_name: displayName,
  });

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
