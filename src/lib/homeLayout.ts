// 2026-07-11부터 홈 위젯 4개가 각각 독립 단위 — "오늘 뭐먹지"/"오늘 뭐하지"/"하고싶은 말"/"장바구니".
// (예전엔 "meal"=오늘뭐먹지+오늘뭐하지 통합, "board"=하고싶은말+장바구니 통합, 2개 위젯 체계였음)
export type HomeSectionId = "mealToday" | "scheduleToday" | "sticky" | "shopping";

export const HOME_SECTION_IDS: HomeSectionId[] = [
  "mealToday",
  "scheduleToday",
  "sticky",
  "shopping",
];

function isHomeSectionId(value: unknown): value is HomeSectionId {
  return typeof value === "string" && (HOME_SECTION_IDS as string[]).includes(value);
}

/** 저장된 순서에서 알려진 섹션 id만 남기고, 새로 추가돼 저장값에 없는 섹션은
 * 뒤에 이어 붙인다 (섹션이 늘어나도 기존 사용자의 저장값이 깨지지 않도록).
 * 2026-07-11 이전의 구 레이아웃("meal"/"board" 2개 위젯 체계) 저장값이 남아있으면
 * 새 4개 위젯 체계와 아이디 자체가 달라 이어붙일 수 없으므로, 기본 배치로 폴백한다. */
export function resolveHomeLayout(stored: unknown): HomeSectionId[] {
  if (!Array.isArray(stored) || stored.length === 0) return [...HOME_SECTION_IDS];

  const isLegacy = stored.some((v) => v === "meal" || v === "board");
  if (isLegacy) return [...HOME_SECTION_IDS];

  const storedIds = stored.filter(isHomeSectionId);
  const missing = HOME_SECTION_IDS.filter((id) => !storedIds.includes(id));
  return [...storedIds, ...missing];
}
