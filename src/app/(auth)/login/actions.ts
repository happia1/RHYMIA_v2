"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** 이메일/비밀번호 로그인 또는 회원가입 직후, users 테이블 동기화 + 목적지 결정 */
export async function completeEmailAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase.from("users").upsert(
    {
      id: user!.id,
      email: user!.email,
      nickname: user!.user_metadata?.nickname ?? null,
      provider: "email",
    },
    { onConflict: "id" }
  );

  const { data: membership } = await supabase
    .from("workspace_member")
    .select("id")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  redirect(membership ? "/home" : "/workspace");
}
