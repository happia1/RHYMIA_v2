/** 네이버 블로그 검색(레시피 찾아보기) 관련 헬퍼 — 서버(env 게이트 확인)/클라이언트
 * (검색 요청) 양쪽에서 쓰는 순수 함수만 모아둔다. 실제 네이버 API 호출은
 * /api/search/recipe-blog 라우트가 전담(클라이언트에 Client Secret이 노출되면 안 되므로). */

/** NAVER_CLIENT_ID/SECRET이 설정돼 있어야만 기능 자체를 노출한다(기존 날씨 API 키 게이트와
 * 동일한 패턴 — src/lib/weather.ts). 서버 컴포넌트에서만 호출할 것(process.env는
 * NEXT_PUBLIC_ 접두사가 없어 클라이언트에서는 항상 false로 보임). */
export function isRecipeSearchEnabled(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

export interface RecipeBlogResult {
  title: string;
  summary: string;
  link: string;
  blogName: string;
}

/** 붙여넣은/입력한 메뉴명으로 블로그 레시피를 검색한다 — 실제 조회는 서버 라우트
 * (/api/search/recipe-blog)를 경유(로그인 검증 + Client Secret 서버 전용 보관). */
export async function searchRecipeBlogs(
  query: string
): Promise<{ items: RecipeBlogResult[] } | { error: string }> {
  try {
    const res = await fetch(`/api/search/recipe-blog?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "레시피를 검색하지 못했어요." };
    return { items: data.items as RecipeBlogResult[] };
  } catch {
    return { error: "레시피를 검색하지 못했어요." };
  }
}
