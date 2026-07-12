import { requireWorkspaceContext } from "@/lib/workspace";
import { getWorkspaceMembers } from "@/lib/members";
import { BoardSection } from "@/components/home/BoardSection";
import type { NoticeComment } from "@/types";

export default async function BoardPage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const [{ data: notices }, members] = await Promise.all([
    supabase
      .from("notice")
      .select("*, notice_like(user_id)")
      .eq("workspace_id", workspaceId)
      .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false }),
    getWorkspaceMembers(workspaceId),
  ]);

  // 작성자 표시용 — notice.created_by는 실제 로그인 user_id라 managed 멤버는 대상이 아님
  const membersById = Object.fromEntries(
    members.filter((m) => m.user_id).map((m) => [m.user_id as string, m])
  );

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
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-section overflow-hidden px-4 pt-6">
      <h1 className="shrink-0 text-[20px] font-medium text-ink">게시판</h1>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pb-6">
        <BoardSection
          workspaceId={workspaceId}
          notices={notices ?? []}
          currentUserId={user.id}
          membersById={membersById}
          commentsByNotice={commentsByNotice}
        />
      </div>
    </div>
  );
}
