/** "로그인 상태 유지" 여부를 인증 쿠키와 별개로 기록해두는 마커 쿠키 — 로그인/회원가입
 * 서버 액션이 Supabase 인증 쿠키와 항상 같은 만료 정책(세션 vs 장기)으로 함께 심고,
 * middleware.ts가 토큰을 갱신할 때 이 마커를 읽어 원래 선택을 그대로 유지한다.
 *
 * 왜 필요한가: 브라우저가 서버로 보내는 Cookie 헤더에는 그 쿠키가 원래 세션 쿠키였는지
 * 장기 쿠키였는지 정보가 없다(만료 시각은 응답 쪽 속성이라 요청에는 안 실림). 그런데
 * @supabase/ssr(0.12.0)은 인증 토큰을 갱신할 때마다 쿠키를 다시 쓰면서 maxAge를 자기
 * 기본값(400일)으로 강제한다(node_modules/@supabase/ssr/dist/main/cookies.js의
 * setCookieOptions 참고 — cookieOptions로 넘긴 값도 그 뒤에 덮어써버려서 무시됨). 이 마커가
 * 없으면 "로그인 상태 유지"를 끄고 세션 쿠키로 로그인한 사용자가, 미들웨어의 통상적인
 * 토큰 갱신 한 번만으로 조용히 장기 로그인으로 격상돼버린다. */
export const PERSIST_COOKIE_NAME = "fridge-persist";

// @supabase/ssr의 기본 인증 쿠키 만료(400일)와 맞춘 값 — "유지" 쪽은 이미 그 기본 동작과
// 같으므로 별도로 지정하지 않아도 되지만, 마커 쿠키 자체의 만료도 인증 쿠키와 나란히
// 가도록 명시한다.
export const PERSIST_MAX_AGE = 60 * 60 * 24 * 400;

/** Supabase 쿠키 setAll에서 받은 옵션에 이 결과를 이어붙이면(스프레드 순서:
 * `{ ...options, ...persistenceOverride(keepLoggedIn) }`), "유지"는 옵션을 그대로 두고
 * (기본 400일 유지), "세션"은 maxAge/expires를 지워 브라우저 완전 종료 시 삭제되는 진짜
 * 세션 쿠키로 만든다. */
export function persistenceOverride(keepLoggedIn: boolean) {
  return keepLoggedIn ? {} : { maxAge: undefined, expires: undefined };
}
