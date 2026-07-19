import "server-only";
import type { MealNutritionEstimate } from "@/types";

const MODEL_NAME = "gemini-2.5-flash";
// 외부 API가 응답 없이 멈추면 끼니 저장 자체는 이미 끝났어도(fire-and-forget) 함수
// 인스턴스가 오래 붙잡혀 있게 된다 — 타임아웃으로 끊어낸다.
const FETCH_TIMEOUT_MS = 10000;

const EMPTY_ESTIMATE: MealNutritionEstimate = {
  kcal_min: null,
  kcal_max: null,
  macro_carb: null,
  macro_protein: null,
  macro_fat: null,
};

function buildInstruction(menuName: string): string {
  return `아래는 가정에서 먹은 끼니의 메뉴입니다: "${menuName}"

일반적인 성인 1인분 기준으로 예상 칼로리와 탄수화물/단백질/지방 비율을 추정하세요.
이것은 정밀한 영양 계산이 아니라 대략적인 참고용 추정치입니다 — 메뉴 정보만으로는 확신하기
어려우니, 확신이 없을수록 칼로리 범위(kcal_min~kcal_max)를 더 넓게 잡으세요. 좁은 범위는
꽤 확신이 있을 때만 쓰세요.

아래 JSON 객체 하나로만 답하세요. 설명이나 마크다운 없이 JSON만 출력하세요.
{
  "kcal_min": 정수(kcal, 하한),
  "kcal_max": 정수(kcal, 상한, kcal_min 이상),
  "macro_carb": 정수(탄수화물 비율 %),
  "macro_protein": 정수(단백질 비율 %),
  "macro_fat": 정수(지방 비율 %)
}
macro_carb + macro_protein + macro_fat의 합은 반드시 100이어야 합니다.`;
}

function stripJsonFence(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text;
}

function clampInt(val: unknown, lo: number, hi: number): number | null {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

/** 세 비율의 합이 정확히 100이 되도록 스케일링하고, 반올림 오차는 가장 큰 값에 몰아준다. */
function normalizeMacros(carb: number, protein: number, fat: number): [number, number, number] {
  const values = [Math.max(0, carb), Math.max(0, protein), Math.max(0, fat)];
  const total = values[0] + values[1] + values[2];
  if (total <= 0) return [50, 25, 25]; // 정보가 전혀 없을 때의 중립 기본값(탄수화물 위주 식사 가정)

  const scaled = values.map((v) => Math.round((v * 100) / total));
  const diff = 100 - (scaled[0] + scaled[1] + scaled[2]);
  const maxIdx = scaled.indexOf(Math.max(...scaled));
  scaled[maxIdx] += diff;
  return [scaled[0], scaled[1], scaled[2]];
}

function parseNutritionJson(text: string): MealNutritionEstimate {
  let data: unknown;
  try {
    data = JSON.parse(stripJsonFence(text));
  } catch {
    return EMPTY_ESTIMATE;
  }
  if (typeof data !== "object" || data === null) return EMPTY_ESTIMATE;
  const obj = data as Record<string, unknown>;

  let kcalMin = clampInt(obj.kcal_min, 0, 5000);
  let kcalMax = clampInt(obj.kcal_max, 0, 5000);
  if (kcalMin === null || kcalMax === null) return EMPTY_ESTIMATE;
  if (kcalMax < kcalMin) [kcalMin, kcalMax] = [kcalMax, kcalMin];

  const carb = clampInt(obj.macro_carb, 0, 100) ?? 0;
  const protein = clampInt(obj.macro_protein, 0, 100) ?? 0;
  const fat = clampInt(obj.macro_fat, 0, 100) ?? 0;
  const [c, p, f] = normalizeMacros(carb, protein, fat);

  return { kcal_min: kcalMin, kcal_max: kcalMax, macro_carb: c, macro_protein: p, macro_fat: f };
}

/** 끼니 메뉴명으로 대략적인 성인 1인분 칼로리 범위 + 탄단지 비율을 추정한다(Gemini
 * REST API 직접 호출, 프롬프트/파싱 로직은 agent/agent.py의 estimate_nutrition을 그대로
 * 이식). 예전엔 별도 배포되는 Python 에이전트 서버(agent/main.py)의 /estimate-nutrition을
 * 호출했는데, 그 서버가 프로덕션(Vercel)에는 배포된 적이 없어서(NEXT_PUBLIC_AGENT_API_URL이
 * 없으면 도달 불가능한 localhost:8000으로 폴백) 모든 끼니의 칼로리가 계속 조용히 비어
 * 있었다 — fetch 실패가 try/catch로 삼켜지기만 하고 로그도 안 남아 눈치채기 어려웠음
 * (DEV.md "영양 추정 Next 서버 이전" 참고). GEMINI_API_KEY가 없으면 기존과 동일하게 전부
 * null(조용히 스킵) — "실패를 사용자에게 알릴 필요 없는 부가 정보"라는 원칙은 그대로
 * 유지하되, 서버 로그에는 실패 원인을 남겨 다음에 같은 문제를 조용히 놓치지 않게 한다. */
export async function estimateMealNutrition(menuName: string): Promise<MealNutritionEstimate> {
  const apiKey = process.env.GEMINI_API_KEY;
  const name = menuName.trim();
  if (!apiKey || !name) return EMPTY_ESTIMATE;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildInstruction(name) }] }],
          generationConfig: { temperature: 0 },
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      console.error(
        "[estimateMealNutrition] Gemini API error:",
        res.status,
        await res.text().catch(() => "")
      );
      return EMPTY_ESTIMATE;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      console.error(
        "[estimateMealNutrition] unexpected Gemini response shape:",
        JSON.stringify(data).slice(0, 500)
      );
      return EMPTY_ESTIMATE;
    }

    return parseNutritionJson(text);
  } catch (err) {
    console.error("[estimateMealNutrition] request failed:", err);
    return EMPTY_ESTIMATE;
  }
}
