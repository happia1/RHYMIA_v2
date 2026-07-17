/** 식품안전나라(식약처) 조리식품의 레시피 DB(COOKRCP01) OpenAPI 연동.
 * 공식 문서: https://www.foodsafetykorea.go.kr/api/openApiInfo.do?...&svc_no=COOKRCP01
 * 엔드포인트 형식: http://openapi.foodsafetykorea.go.kr/api/{키}/COOKRCP01/{json|xml}/{시작}/{끝}[/{필드}={값}]
 * 응답 포장: { COOKRCP01: { total_count, row: [...], RESULT: { CODE, MSG } } }
 * 이 파일은 서버 전용(FOOD_SAFETY_API_KEY는 서버 전용 환경변수) — 서버 컴포넌트(식탁 탭
 * "추천 레시피")와 /api/recipes route handler(끼니 등록 화면의 인터랙티브 검색) 양쪽에서
 * 공용으로 쓴다. */

const BASE_URL = "http://openapi.foodsafetykorea.go.kr/api";
const SERVICE_ID = "COOKRCP01";
const MANUAL_STEP_COUNT = 20;

export interface NormalizedRecipeStep {
  text: string;
  image: string | null;
}

export interface NormalizedRecipe {
  id: string;
  name: string;
  image: string | null;
  /** 원본 재료 텍스트(RCP_PARTS_DTLS) — 줄바꿈/쉼표 기준으로 대략 나눈 실제 표시용 목록은 ingredients. */
  ingredientsRaw: string;
  ingredients: string[];
  steps: NormalizedRecipeStep[];
  /** 나트륨 저감 조리법 팁(RCP_NA_TIP) — 있으면 상세에 참고용으로만 노출, 없으면 null. */
  tip: string | null;
}

interface RawRecipeRow {
  RCP_SEQ: string;
  RCP_NM: string;
  ATT_FILE_NO_MAIN?: string;
  ATT_FILE_NO_MK?: string;
  RCP_PARTS_DTLS?: string;
  RCP_NA_TIP?: string;
  [key: string]: string | undefined;
}

interface RawResponse {
  [SERVICE_ID]?: {
    total_count?: string;
    row?: RawRecipeRow[];
    RESULT?: { MSG: string; CODE: string };
  };
}

export function isFoodSafetyRecipeEnabled(): boolean {
  return Boolean(process.env.FOOD_SAFETY_API_KEY);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** "[재료] 돼지고기 300g, 대파 1대\n[양념] 고추장 2큰술" 형태의 원본 텍스트를 줄바꿈/쉼표
 * 기준으로 쪼개 대략적인 항목 목록으로 만든다 — 공식 API가 재료를 구조화된 배열이 아니라
 * 자유 텍스트 한 덩어리로만 내려주기 때문에 완벽한 파싱은 불가능하고, 이 정도가 실용적인
 * 선에서 최선이다("[재료]" 같은 구간 헤더도 항목 하나로 섞여 나오는 건 감수). */
function parseIngredients(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSteps(row: RawRecipeRow): NormalizedRecipeStep[] {
  const steps: NormalizedRecipeStep[] = [];
  for (let i = 1; i <= MANUAL_STEP_COUNT; i++) {
    const text = row[`MANUAL${pad2(i)}`]?.trim();
    if (!text) continue;
    const image = row[`MANUAL_IMG${pad2(i)}`]?.trim();
    steps.push({ text, image: image || null });
  }
  return steps;
}

function normalize(row: RawRecipeRow): NormalizedRecipe {
  const ingredientsRaw = row.RCP_PARTS_DTLS ?? "";
  return {
    id: row.RCP_SEQ,
    name: row.RCP_NM,
    image: row.ATT_FILE_NO_MAIN || row.ATT_FILE_NO_MK || null,
    ingredientsRaw,
    ingredients: parseIngredients(ingredientsRaw),
    steps: parseSteps(row),
    tip: row.RCP_NA_TIP?.trim() || null,
  };
}

/** startIdx/endIdx는 1-based, API 자체 상한은 한 번에 1000건. path 세그먼트에 필터를
 * 추가하면(RCP_NM=검색어) 이름 부분일치 검색이 된다. */
async function fetchRows(
  startIdx: number,
  endIdx: number,
  filterSegment?: string
): Promise<{ rows: RawRecipeRow[]; totalCount: number }> {
  const apiKey = process.env.FOOD_SAFETY_API_KEY;
  if (!apiKey) throw new Error("FOOD_SAFETY_API_KEY가 설정되지 않았습니다.");

  const segments = [BASE_URL, apiKey, SERVICE_ID, "json", String(startIdx), String(endIdx)];
  if (filterSegment) segments.push(filterSegment);

  const res = await fetch(segments.join("/"), { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`레시피 API 응답 오류 (status ${res.status})`);

  const data = (await res.json()) as RawResponse;
  const body = data[SERVICE_ID];
  // 검색 결과가 0건일 때는 row 없이 RESULT만 내려온다(정상 — 에러 아님).
  if (!body || body.RESULT?.CODE?.startsWith("ERROR")) {
    throw new Error(body?.RESULT?.MSG ?? "레시피 API 응답 형식이 예상과 다릅니다.");
  }

  return { rows: body.row ?? [], totalCount: Number(body.total_count ?? 0) };
}

/** 메뉴명 검색(끼니 등록 화면의 "레시피(내부) 검색" 탭) — 부분일치, 상위 20건만. */
export async function searchRecipes(query: string): Promise<NormalizedRecipe[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { rows } = await fetchRows(1, 20, `RCP_NM=${encodeURIComponent(trimmed)}`);
  return rows.map(normalize);
}

/** 식탁 탭 "추천 레시피" 배너용 — 날짜를 시드로 매일 같은(당일 내 안정적인) 레시피 1건을
 * 고른다. 이 API는 임의의 인덱스 하나만 콕 집어 가져올 방법이 없어(항상 시작~끝 "범위"
 * 조회) 먼저 total_count만 가볍게 확인한 뒤, 그 범위 안에서 날짜 해시로 인덱스를 정해
 * 그 한 건만 다시 요청한다. 두 요청 모두 24시간 캐시(next.revalidate)라 하루 동안은
 * 실제로 한 번씩만 나간다. */
export async function getDailyRecommendedRecipe(seedDate: string): Promise<NormalizedRecipe | null> {
  const { totalCount } = await fetchRows(1, 1);
  if (totalCount <= 0) return null;

  let hash = 0;
  for (const ch of seedDate) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const index = (hash % totalCount) + 1;

  const { rows } = await fetchRows(index, index);
  return rows[0] ? normalize(rows[0]) : null;
}
