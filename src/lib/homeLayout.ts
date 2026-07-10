// "meal"은 2026-07-08부터 "오늘 뭐먹지 + 오늘 뭐하지" 2단 통합 위젯을 가리킨다
// (예전엔 "meal"과 "today"가 별개 위젯이었으나 두 섹션이 하나로 합쳐지며 "today"는 제거됨).
// "suggestion"(오늘의 제안 카드 캐러셀)은 2026-07-11에 추가됐다가 같은 날 다시 식탁 탭으로
// 이동함 — 홈은 "오늘 등록된 것만" 보여주는 상태판, 결정/추천 UI는 각 탭이 전담한다.
export type HomeSectionId = "meal" | "board";

export const HOME_SECTION_IDS: HomeSectionId[] = ["meal", "board"];

function isHomeSectionId(value: unknown): value is HomeSectionId {
  return typeof value === "string" && (HOME_SECTION_IDS as string[]).includes(value);
}

/** 저장된 순서에서 알려진 섹션 id만 남기고, 새로 추가돼 저장값에 없는 섹션은
 * 뒤에 이어 붙인다 (섹션이 늘어나도 기존 사용자의 저장값이 깨지지 않도록). */
export function resolveHomeLayout(stored: unknown): HomeSectionId[] {
  const storedIds = Array.isArray(stored) ? stored.filter(isHomeSectionId) : [];
  const missing = HOME_SECTION_IDS.filter((id) => !storedIds.includes(id));
  return [...storedIds, ...missing];
}
