"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addNotice(
  workspaceId: string,
  input: {
    type: "sticky" | "memo" | "notice";
    title?: string;
    content: string;
    color?: string;
    isPinned?: boolean;
    expireDays?: number;
    imageUrl?: string | null;
  }
) {
  const content = input.content.trim();
  if (!content) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const expireAt =
    input.type === "sticky" && input.expireDays
      ? new Date(Date.now() + input.expireDays * 86400000).toISOString()
      : null;

  const { error } = await supabase.from("notice").insert({
    workspace_id: workspaceId,
    type: input.type,
    title: input.title?.trim() || null,
    content,
    color: input.color ?? "#FFF9C4",
    image_url: input.type === "sticky" ? input.imageUrl ?? null : null,
    is_pinned: input.isPinned ?? false,
    expire_at: expireAt,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/board");
  revalidatePath("/notifications");
}

export async function deleteNotice(noticeId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notice, error: fetchError } = await supabase
    .from("notice")
    .select("created_by")
    .eq("id", noticeId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!notice || notice.created_by !== user.id) {
    throw new Error("삭제 권한이 없습니다.");
  }

  const { error } = await supabase.from("notice").delete().eq("id", noticeId);
  if (error) throw new Error(error.message);

  revalidatePath("/board");
  revalidatePath("/notifications");
}

export async function addNoticeComment(noticeId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notice_comment")
    .insert({ notice_id: noticeId, user_id: user.id, content: trimmed });

  if (error) throw new Error(error.message);

  revalidatePath("/board");
}
