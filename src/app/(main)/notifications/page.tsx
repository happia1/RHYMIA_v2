import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { mapWorkspaceMembers } from "@/lib/members";
import { formatPostTimestamp } from "@/lib/date";

export default async function NotificationsPage() {
  const { supabase, workspaceId } = await requireWorkspaceContext();

  const [{ data: notices }, { data: memberRows }] = await Promise.all([
    supabase
      .from("notice")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("type", "notice")
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_member")
      .select("user_id, display_name, users(avatar_color, avatar_text_color, avatar_image_url)")
      .eq("workspace_id", workspaceId),
  ]);

  const membersById = Object.fromEntries(
    mapWorkspaceMembers(memberRows ?? []).map((m) => [m.user_id, m])
  );

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-6">
      <header className="flex h-8 items-center gap-2">
        <Link href="/home" aria-label="뒤로가기">
          <IconArrowLeft size={22} className="text-ink" />
        </Link>
        <h1 className="text-[20px] font-medium text-ink">알림</h1>
      </header>

      <div className="flex flex-col gap-2">
        {(notices ?? []).length === 0 && (
          <p className="py-8 text-center text-[13px] text-stone">등록된 공지가 없어요</p>
        )}
        {(notices ?? []).map((n) => {
          const author = membersById[n.created_by ?? ""];
          return (
            <Link
              key={n.id}
              href="/board"
              className="flex flex-col gap-1 rounded-2xl border border-border-light bg-white p-4"
            >
              {n.title && (
                <span className="text-[14px] font-medium text-ink">📌 {n.title}</span>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-stone">
                <span className="font-medium">{author?.display_name ?? "가족"}</span>
                <span>· {formatPostTimestamp(n.created_at)}</span>
              </div>
              <p className="line-clamp-2 text-[13px] text-ink">{n.content}</p>
              <span className="mt-1 self-end text-[12px] font-medium text-ocean">
                게시판에서 보기
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
