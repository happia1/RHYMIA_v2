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

  const { data: existing, error: existingError } = await supabase
    .from("workspace_member")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) redirect("/home");

  const { data: workspace, error: workspaceError } = await supabase
    .from("family_workspace")
    .select("member_limit")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError) throw new Error(workspaceError.message);
  if (!workspace) return { ok: false as const, message: "유효하지 않은 워크스페이스입니다." };

  const { count, error: countError } = await supabase
    .from("workspace_member")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= workspace.member_limit) {
    return { ok: false as const, message: "가족 구성원 정원이 가득 찼습니다." };
  }

  const { error } = await supabase.from("workspace_member").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    role: "member",
    display_name: displayName,
  });

  if (error) throw new Error(error.message);

  redirect("/home");
}
