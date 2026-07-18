"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 이메일/비밀번호 로그인 또는 회원가입 직후, users 테이블 동기화 + 목적지 결정.
 * redirectTo가 있으면(초대 링크에서 로그인/가입하러 온 경우) 그 경로로 돌아가고,
 * 없으면 기존 규칙대로 이미 워크스페이스가 있으면 /home, 없으면 온보딩(/workspace)으로.
 * "/"로 시작하는 내부 경로만 허용해 외부 주소로 리다이렉트되는 걸 막는다. */
export async function completeEmailAuth(redirectTo?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error: upsertError } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      nickname: user.user_metadata?.nickname ?? null,
      provider: "email",
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("[completeEmailAuth] users upsert failed:", upsertError);
    throw new Error(`사용자 정보 저장에 실패했습니다: ${upsertError.message}`);
  }

  if (redirectTo && redirectTo.startsWith("/")) {
    redirect(redirectTo);
  }

  const { data: membership } = await supabase
    .from("workspace_member")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  redirect(membership ? "/home" : "/workspace");
}
