import { requireAuthOrRespond } from "@/lib/agentServer";
import { estimateMealNutrition } from "@/lib/nutritionEstimate";

/** 끼니 메뉴명으로 대략적인 칼로리/탄단지 비율을 추정 — 예전엔 별도 배포되는 Python
 * 에이전트 서버를 거쳤지만(프로덕션에 배포된 적이 없어 항상 조용히 실패), 이제
 * estimateMealNutrition()이 Gemini를 직접 호출한다(nutritionEstimate.ts 참고). 백그라운드
 * 추정(food/actions.ts의 estimateAndSaveMealNutrition)은 이미 서버 코드라 이 라우트를
 * 거치지 않고 estimateMealNutrition()을 바로 부르고, 이 라우트는 클라이언트에서 직접
 * 호출할 수 있는 인증된 진입점 용도다. */
export async function POST(request: Request) {
  const authError = await requireAuthOrRespond();
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const menuName = typeof body?.menuName === "string" ? body.menuName : "";
  if (!menuName.trim()) {
    return Response.json({ error: "menuName is required" }, { status: 400 });
  }

  const estimate = await estimateMealNutrition(menuName);
  return Response.json(estimate);
}
