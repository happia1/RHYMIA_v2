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
    image_url: input.imageUrl ?? null,
    is_pinned: input.isPinned ?? false,
    expire_at: expireAt,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/board");
  revalidatePath("/notifications");
}

export async function updateNotice(
  noticeId: string,
  input: {
    /** 메모⇄공지 전환용 — sticky(하고싶은 말)는 이 값이 와도 무시하고(아래 nextType 참고) 절대 바뀌지 않는다 */
    type?: "memo" | "notice";
    title?: string;
    content: string;
    color?: string;
    isPinned?: boolean;
    imageUrl?: string | null;
  }
) {
  const content = input.content.trim();
  if (!content) return { ok: false as const, message: "내용을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notice, error: fetchError } = await supabase
    .from("notice")
    .select("created_by, type")
    .eq("id", noticeId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!notice || notice.created_by !== user.id) {
    return { ok: false as const, message: "수정 권한이 없습니다." };
  }

  // 스티키(하고싶은 말)는 색상/이미지/만료일 등 구조가 달라 전환 대상이 아니다 —
  // 메모⇄공지 사이에서만 유형 전환을 허용한다.
  const nextType = notice.type !== "sticky" && input.type ? input.type : notice.type;

  const { error } = await supabase
    .from("notice")
    .update({
      type: nextType,
      title: input.title?.trim() || null,
      content,
      color: nextType === "sticky" ? input.color ?? "#FFF9C4" : undefined,
      image_url: input.imageUrl ?? null,
      is_pinned: nextType !== "sticky" ? input.isPinned ?? false : undefined,
    })
    .eq("id", noticeId);

  if (error) throw new Error(error.message);

  revalidatePath("/board");
  revalidatePath("/notifications");
  // 홈의 고정 메모 영역·"하고싶은 말" 위젯도 이 데이터를 직접 조회하므로 함께 무효화한다
  // (수정/삭제가 이제 홈 화면 위의 팝업에서도 일어날 수 있음).
  revalidatePath("/home");
  return { ok: true as const };
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
    return { ok: false as const, message: "삭제 권한이 없습니다." };
  }

  const { error } = await supabase.from("notice").delete().eq("id", noticeId);
  if (error) throw new Error(error.message);

  revalidatePath("/board");
  revalidatePath("/notifications");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function toggleNoticeLike(noticeId: string, liked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (liked) {
    const { error } = await supabase
      .from("notice_like")
      .insert({ notice_id: noticeId, user_id: user.id });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("notice_like")
      .delete()
      .eq("notice_id", noticeId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/board");
  revalidatePath("/home");
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
  revalidatePath("/home");
}
