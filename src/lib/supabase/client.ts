import { createBrowserClient } from "@supabase/ssr";

/** 브라우저 전용 Supabase 클라이언트 — 이미 로그인된 상태에서 클라이언트 컴포넌트가
 * Storage 업로드/직접 테이블 조회 등에 쓰는 용도. 로그인/회원가입은 이제
 * `(auth)/login/actions.ts`의 signInAction/signUpAction(서버 액션)에서 처리해 Set-Cookie로
 * 세션을 심는다 — iOS Safari가 document.cookie(JS)로 쓰는 쿠키에만 거는 7일 캡을 피하기
 * 위해서다. 예전엔 여기서 signIn까지 하면서 "로그인 상태 유지"를 끈 경우 브라우저 세션
 * 쿠키를 직접 document.cookie로 구워야 했지만(parseDocumentCookies/writeSessionCookie),
 * 그 로그인 책임 자체가 서버로 옮겨가면서 이 클라이언트엔 그 로직이 더 이상 필요 없다. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
