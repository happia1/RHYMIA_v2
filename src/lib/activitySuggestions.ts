/** 일정 탭 — 선택한 날짜에 등록된 일정이 없을 때 달력 하단에 보여주는 "오늘 뭐하지" 활동 추천 풀.
 * 나이/취미 등 실제 사용자별 데이터를 아직 저장하지 않아 정교한 개인화는 못 하고(향후 과제),
 * 다양한 라이프스타일을 폭넓게 아우르는 정적 큐레이션 목록에서 고른다. */
export const ACTIVITY_SUGGESTION_POOL = [
  "영화·드라마 보면서 맛있는 거 먹기",
  "다 같이 영화 보기",
  "캠핑 가기",
  "동네 산책하기",
  "가족 보드게임 하기",
  "홈베이킹 도전하기",
  "근처 공원 나들이",
  "자전거 타기",
  "새로운 카페 가보기",
  "책 읽기",
  "함께 요리하기",
  "동네 맛집 탐방",
  "가까운 전시·공연 보러 가기",
  "방 대청소하기",
  "온 가족 낮잠 자기",
];

/** 날짜 시드로 풀을 회전시켜 연속된 N개를 뽑는다 — 매번 다른 조합을 보여주되 서버/클라이언트
 * 계산 결과가 항상 같아야 하므로(하이드레이션 불일치 방지) Math.random 대신 해시 기반으로 고른다. */
export function pickActivityCandidates(seed: string, count = 6): string[] {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const offset = hash % ACTIVITY_SUGGESTION_POOL.length;
  return Array.from(
    { length: Math.min(count, ACTIVITY_SUGGESTION_POOL.length) },
    (_, i) => ACTIVITY_SUGGESTION_POOL[(offset + i) % ACTIVITY_SUGGESTION_POOL.length]
  );
}
