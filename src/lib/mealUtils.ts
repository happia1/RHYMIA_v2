export const MEAL_TAGS = ["아침", "브런치", "점심", "간식", "저녁", "야식"] as const;

/** kcal_min~kcal_max 범위의 중앙값을 50 단위로 반올림 — 끼니 카드/하루 합계/상세 어디서든
 * "약 {중앙값}kcal" 표기에 이 값을 쓴다(추정치임을 표시할 뿐 소수점까지 정밀한 척 하지 않기 위함).
 * 둘 중 하나라도 없으면(추정 안 됨) null. */
export function mealKcalMedian(meal: { kcal_min: number | null; kcal_max: number | null }) {
  if (meal.kcal_min == null || meal.kcal_max == null) return null;
  return Math.round((meal.kcal_min + meal.kcal_max) / 2 / 50) * 50;
}

const TAG_HOUR: Record<string, number> = {
  아침: 7,
  브런치: 10,
  점심: 12,
  간식: 15,
  저녁: 18,
  야식: 21,
};

export function tagOrderIndex(tag: string) {
  const idx = MEAL_TAGS.indexOf(tag as (typeof MEAL_TAGS)[number]);
  return idx === -1 ? MEAL_TAGS.length : idx;
}

/** 현재 시각과 가장 가까운 끼니 태그 — "늘 먹던 걸로"/"대신 골라줘" 원클릭 등록 시 기본값으로 사용. */
export function currentMealTag(now = new Date()): (typeof MEAL_TAGS)[number] {
  const hour = now.getHours() + now.getMinutes() / 60;
  let best: (typeof MEAL_TAGS)[number] = MEAL_TAGS[0];
  let bestDiff = Infinity;
  for (const tag of MEAL_TAGS) {
    const diff = Math.abs(TAG_HOUR[tag] - hour);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = tag;
    }
  }
  return best;
}

/** 과거 meal 기록에서 자주(그다음 최근) 등록한 메뉴 이름을 뽑는다 — "늘 먹던 걸로" 칩에 사용.
 * main_menu는 쉼표로 여러 메뉴가 들어있을 수 있어 개별 메뉴 단위로 집계한다. */
export function getFrequentMenus(
  meals: { main_menu: string; date: string }[],
  limit = 3
): string[] {
  const stats = new Map<string, { count: number; lastDate: string }>();
  for (const m of meals) {
    for (const menu of m.main_menu.split(",").map((s) => s.trim()).filter(Boolean)) {
      const entry = stats.get(menu);
      if (entry) {
        entry.count += 1;
        if (m.date > entry.lastDate) entry.lastDate = m.date;
      } else {
        stats.set(menu, { count: 1, lastDate: m.date });
      }
    }
  }
  return Array.from(stats.entries())
    .sort((a, b) => b[1].count - a[1].count || (a[1].lastDate < b[1].lastDate ? 1 : -1))
    .slice(0, limit)
    .map(([menu]) => menu);
}

// 룰렛/이상형 월드컵 후보가 8개보다 적을 때 채워 넣는 기본 메뉴 풀 (등록 기록이 적은 초반에도 재미 요소가 동작하도록)
export const DEFAULT_MENU_POOL = [
  "된장찌개", "김치볶음밥", "제육볶음", "계란말이", "돈까스", "파스타",
  "초밥", "고기구이", "치킨", "피자", "짜장면", "떡볶이", "김치찌개", "비빔밥",
];

/** 룰렛/이상형 월드컵 후보를 최근 메뉴 → 기본 풀 순서로 중복 없이 채워 지정한 개수(기본 8개)를 맞춘다. */
export function buildCandidatePool(recentMenus: string[], size = 8): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const menu of [...recentMenus, ...DEFAULT_MENU_POOL]) {
    if (seen.has(menu)) continue;
    seen.add(menu);
    pool.push(menu);
    if (pool.length >= size) break;
  }
  return pool;
}
