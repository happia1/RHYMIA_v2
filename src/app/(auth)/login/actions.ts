"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import {
  PERSIST_COOKIE_NAME,
  PERSIST_MAX_AGE,
  persistenceOverride,
} from "@/lib/supabase/authPersistence";

/** 로그인/회원가입 전용 서버 클라이언트 — "로그인 상태 유지" 여부에 따라 인증 쿠키의
 * 만료 방식을 직접 강제한다(persistenceOverride, 이유는 authPersistence.ts 참고). 서버
 * Set-Cookie로 내려가므로 iOS Safari가 document.cookie(JS)로 쓰는 쿠키에만 거는 7일
 * 캡을 받지 않는다 — 이게 로그인/회원가입을 클라이언트에서 서버 액션으로 옮긴 이유. */
async function createAuthActionClient(keepLoggedIn: boolean) {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, ...persistenceOverride(keepLoggedIn) });
          });
        },
      },
    }
  );
}

function markPersistPreference(keepLoggedIn: boolean, cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(PERSIST_COOKIE_NAME, "1", {
    path: "/",
    sameSite: "lax",
    ...(keepLoggedIn ? { maxAge: PERSIST_MAX_AGE } : {}),
  });
}

type AuthClient = Awaited<ReturnType<typeof createAuthActionClient>>;

/** 로그인/회원가입 직후 공통 처리 — users 테이블 동기화 + 목적지 결정. redirectTo가
 * 있으면(초대 링크에서 로그인/가입하러 온 경우) 그 경로로 돌아가고, 없으면 기존 규칙대로
 * 이미 워크스페이스가 있으면 /home, 없으면 온보딩(/workspace)으로. "/"로 시작하는 내부
 * 경로만 허용해 외부 주소로 리다이렉트되는 걸 막는다. */
async function afterAuth(supabase: AuthClient, redirectTo?: string) {
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
    console.error("[afterAuth] users upsert failed:", upsertError);
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

export async function signInAction(input: {
  email: string;
  password: string;
  keepLoggedIn: boolean;
  redirectTo?: string;
}): Promise<{ ok: false; message: string } | undefined> {
  const supabase = await createAuthActionClient(input.keepLoggedIn);
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않아요." };
  }

  markPersistPreference(input.keepLoggedIn, await cookies());
  await afterAuth(supabase, input.redirectTo);
}

export async function signUpAction(input: {
  email: string;
  password: string;
  keepLoggedIn: boolean;
  redirectTo?: string;
}): Promise<
  { ok: false; message: string } | { ok: true; needsEmailConfirmation: true } | undefined
> {
  const supabase = await createAuthActionClient(input.keepLoggedIn);
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!data.session) {
    // 이메일 인증 링크 확인 전 — 아직 로그인되지 않았으므로 세션/유지 쿠키를 심지 않는다.
    return { ok: true, needsEmailConfirmation: true };
  }

  markPersistPreference(input.keepLoggedIn, await cookies());
  await afterAuth(supabase, input.redirectTo);
}
