"use server";

import { revalidatePath } from "next/cache";
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

  await supabase.from("notice").insert({
    workspace_id: workspaceId,
    type: input.type,
    title: input.title?.trim() || null,
    content,
    color: input.color ?? "#FFF9C4",
    is_pinned: input.isPinned ?? false,
    expire_at: expireAt,
    created_by: user.id,
  });

  revalidatePath("/board");
  revalidatePath("/notifications");
}

export async function deleteNotice(noticeId: string) {
  const supabase = await createClient();
  await supabase.from("notice").delete().eq("id", noticeId);
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

  await supabase
    .from("notice_comment")
    .insert({ notice_id: noticeId, user_id: user.id, content: trimmed });

  revalidatePath("/board");
}
