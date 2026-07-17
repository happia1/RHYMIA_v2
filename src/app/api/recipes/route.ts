import { requireAuthOrRespond } from "@/lib/agentServer";
import { isFoodSafetyRecipeEnabled, searchRecipes } from "@/lib/foodSafetyRecipe";

/** 끼니 등록 화면의 "레시피(내부) 검색" 탭 — 식품안전나라 COOKRCP01을 메뉴명으로 검색.
 * NAVER 블로그 검색(/api/search/recipe-blog)과 동일한 게이트/인증 패턴. */
export async function GET(request: Request) {
  const authError = await requireAuthOrRespond();
  if (authError) return authError;

  if (!isFoodSafetyRecipeEnabled()) {
    return Response.json({ error: "내부 레시피 검색이 아직 설정되지 않았어요." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return Response.json({ error: "검색어를 입력해주세요." }, { status: 400 });
  }

  try {
    const items = await searchRecipes(query);
    return Response.json({ items });
  } catch {
    return Response.json({ error: "레시피를 검색하지 못했어요." }, { status: 502 });
  }
}
