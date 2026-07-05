import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireWorkspaceContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_member")
    .select("workspace_id, role, display_name")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/workspace");

  return {
    supabase,
    user: user!,
    workspaceId: membership!.workspace_id as string,
    role: membership!.role as string,
    displayName: membership!.display_name as string | null,
  };
}
