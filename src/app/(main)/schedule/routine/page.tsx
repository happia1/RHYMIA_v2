import { requireWorkspaceContext } from "@/lib/workspace";
import { mapWorkspaceMembers } from "@/lib/members";
import { RoutineEditor } from "@/components/schedule/RoutineEditor";
import type { Routine } from "@/types";

export default async function RoutinePage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const { data: memberRows } = await supabase
    .from("workspace_member")
    .select(
      "id, user_id, member_type, display_name, name, avatar_color, avatar_image_url, birth_year, users(avatar_color, avatar_text_color, avatar_image_url)"
    )
    .eq("workspace_id", workspaceId);

  const members = mapWorkspaceMembers(memberRows ?? []);
  const myMember = members.find((m) => m.user_id === user.id);

  // 편집 대상: 나 자신 + 같은 워크스페이스의 managed 멤버(자녀 등) — 다른 account 멤버의
  // 루틴은 RLS(can_write_routine)가 애초에 막고 있어 선택지에도 넣지 않는다.
  const editableMembers = members.filter(
    (m) => m.user_id === user.id || m.member_type === "managed"
  );
  const memberIds = editableMembers.map((m) => m.id);

  const { data: routines } = await supabase
    .from("routine")
    .select("*")
    .in("member_id", memberIds.length ? memberIds : [""]);

  return (
    <RoutineEditor
      initialRoutines={(routines as Routine[]) ?? []}
      members={editableMembers}
      defaultMemberId={myMember?.id ?? ""}
    />
  );
}
