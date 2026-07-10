"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function setAvatarImageUrl(url: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ avatar_image_url: url })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/settings");
  revalidatePath("/food");
}

export async function updateAvatarImage(imageUrl: string) {
  await setAvatarImageUrl(imageUrl);
}

export async function clearAvatarImage() {
  await setAvatarImageUrl(null);
}

export interface ManagedMemberInput {
  name: string;
  avatarColor: string;
  birthYear: number | null;
}

export async function createManagedMember(workspaceId: string, input: ManagedMemberInput) {
  const name = input.name.trim();
  if (!name) throw new Error("이름을 입력해주세요.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace, error: workspaceError } = await supabase
    .from("family_workspace")
    .select("member_limit")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError) throw new Error(workspaceError.message);
  if (!workspace) throw new Error("유효하지 않은 워크스페이스입니다.");

  const { count, error: countError } = await supabase
    .from("workspace_member")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= workspace.member_limit) {
    throw new Error("가족 구성원 정원이 가득 찼습니다.");
  }

  const { error } = await supabase.from("workspace_member").insert({
    workspace_id: workspaceId,
    member_type: "managed",
    user_id: null,
    role: "member",
    name,
    avatar_color: input.avatarColor,
    birth_year: input.birthYear,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function updateManagedMember(memberId: string, input: ManagedMemberInput) {
  const name = input.name.trim();
  if (!name) throw new Error("이름을 입력해주세요.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("workspace_member")
    .update({
      name,
      avatar_color: input.avatarColor,
      birth_year: input.birthYear,
    })
    .eq("id", memberId)
    .eq("member_type", "managed");

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/home");
  return { ok: true as const };
}

export async function deleteManagedMember(memberId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // routine은 workspace_member FK가 ON DELETE CASCADE라 함께 삭제됨.
  // schedule.target_members 배열 안의 이 id는 별도 FK가 없어 자동으로 정리되지 않고
  // 남아있게 되지만(대상 표시가 "가족"으로 보일 뿐 오류는 아님), UI에서 미리 안내한다.
  const { error } = await supabase
    .from("workspace_member")
    .delete()
    .eq("id", memberId)
    .eq("member_type", "managed");

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/schedule");
  return { ok: true as const };
}

export async function regenerateShareToken(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  if (!membership || membership.role !== "owner") {
    throw new Error("공유 링크는 오너만 재발급할 수 있습니다.");
  }

  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from("family_workspace")
    .update({ share_token: newToken })
    .eq("id", workspaceId);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  return { shareToken: newToken };
}
