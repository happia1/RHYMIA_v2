import { createBrowserClient } from "@supabase/ssr";

/**
 * "로그인 상태 유지" 체크 해제 시 브라우저 세션 쿠키(만료 시각 없음 → 브라우저를
 * 완전히 종료하면 삭제됨)로 직접 관리한다. @supabase/ssr 0.12.0은 내부적으로
 * cookieOptions.maxAge를 넘겨도 항상 자체 기본값(400일)으로 덮어써버려서,
 * 세션 쿠키를 만들려면 cookies.getAll/setAll을 완전히 우리가 구현해야 한다.
 */
function parseDocumentCookies(): { name: string; value: string }[] {
  return document.cookie
    .split("; ")
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      return {
        name: idx === -1 ? pair : pair.slice(0, idx),
        value: idx === -1 ? "" : decodeURIComponent(pair.slice(idx + 1)),
      };
    });
}

function writeSessionCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // max-age/expires를 생략하면 브라우저 세션 쿠키가 되어, 브라우저를
  // 완전히 종료했을 때 자동으로 삭제된다.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax${secure}`;
}

export function createClient(options?: { persistSession?: boolean }) {
  const persistSession = options?.persistSession ?? true;

  if (persistSession) {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: parseDocumentCookies,
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => writeSessionCookie(name, value));
        },
      },
    }
  );
}
