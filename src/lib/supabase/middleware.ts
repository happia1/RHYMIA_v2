import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");
  const isAuthCallback = request.nextUrl.pathname.startsWith("/auth");
  const isPublicShare = request.nextUrl.pathname.startsWith("/share");
  // 초대 링크는 비로그인 상태로도 열려야 한다 — 페이지 자체가 "OO 가족에 초대됐어요"
  // 화면을 보여주고 로그인/회원가입 이후 이 경로로 되돌아와 자동으로 이어지게 한다.
  const isWorkspaceJoin = request.nextUrl.pathname.startsWith("/workspace/join");

  // getUser()가 액세스 토큰을 갱신했다면 그 결과가 supabaseResponse에만 담겨 있다 —
  // 아래 두 분기처럼 새 NextResponse.redirect()를 따로 만들어 그대로 반환하면 방금 갱신된
  // 쿠키가 브라우저로 전달되지 않고 버려진다(요청마다 토큰을 리프레시하는 표준 패턴에서
  // 리다이렉트 경로만 이 갱신을 누락하던 버그 — DEV.md 참고). 리다이렉트 응답에도 반드시
  // supabaseResponse의 쿠키를 그대로 옮겨 실어 보낸다.
  const withRefreshedCookies = (response: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  if (!user && !isAuthRoute && !isAuthCallback && !isPublicShare && !isWorkspaceJoin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  return supabaseResponse;
}
