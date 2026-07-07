import { requireWorkspaceContext } from "@/lib/workspace";
import { mapWorkspaceMembers } from "@/lib/members";
import { BoardSection } from "@/components/home/BoardSection";
import { ShoppingList } from "@/components/home/ShoppingList";
import type { NoticeComment } from "@/types";

export default async function BoardPage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const [{ data: notices }, { data: shoppingItems }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from("notice")
        .select("*")
        .eq("workspace_id", workspaceId)
        .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("shopping_item")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("added_at", { ascending: false }),
      supabase
        .from("workspace_member")
        .select("user_id, display_name, users(avatar_color, avatar_text_color, avatar_image_url)")
        .eq("workspace_id", workspaceId),
    ]);

  const members = mapWorkspaceMembers(memberRows ?? []);
  const membersById = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const noticeIds = (notices ?? []).map((n) => n.id);
  const { data: commentRows } = noticeIds.length
    ? await supabase
        .from("notice_comment")
        .select("*")
        .in("notice_id", noticeIds)
        .order("created_at", { ascending: true })
    : { data: [] as NoticeComment[] };

  const commentsByNotice: Record<string, NoticeComment[]> = {};
  for (const c of commentRows ?? []) {
    (commentsByNotice[c.notice_id] ??= []).push(c);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-6">
      <h1 className="text-[20px] font-medium text-ink">게시판</h1>

      <div className="grid grid-cols-board gap-4">
        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-medium text-stone">스티커 · 공지 · 메모</span>
          <BoardSection
            workspaceId={workspaceId}
            notices={notices ?? []}
            currentUserId={user.id}
            membersById={membersById}
            commentsByNotice={commentsByNotice}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-medium text-stone">장바구니</span>
          <div className="max-h-[70vh] overflow-y-auto">
            <ShoppingList workspaceId={workspaceId} items={shoppingItems ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
