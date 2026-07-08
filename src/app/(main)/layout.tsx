import { requireWorkspaceContext } from "@/lib/workspace";
import { mapWorkspaceMembers } from "@/lib/members";
import { DockBar } from "@/components/ui/DockBar";
import { AgentLauncher } from "@/components/agent/AgentLauncher";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, workspaceId } = await requireWorkspaceContext();

  const { data: memberRows } = await supabase
    .from("workspace_member")
    .select("user_id, display_name, users(avatar_color, avatar_text_color, avatar_image_url)")
    .eq("workspace_id", workspaceId);

  const members = mapWorkspaceMembers(memberRows ?? []);

  return (
    <div className="min-h-screen bg-cream pb-[64px]">
      {children}
      <AgentLauncher workspaceId={workspaceId} members={members} />
      <DockBar />
    </div>
  );
}
