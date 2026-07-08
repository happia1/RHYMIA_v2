export type HomeSectionId = "meal" | "today" | "board";

export const HOME_SECTION_IDS: HomeSectionId[] = ["meal", "today", "board"];

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
