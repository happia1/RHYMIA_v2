/** 문자열 시드로부터 결정론적(서버/클라이언트 동일 결과)으로 풀에서 하나를 뽑는다.
 * 클라이언트 컴포넌트 첫 렌더에서 Math.random()을 쓰면 SSR과 하이드레이션 결과가
 * 달라질 수 있어(hydration mismatch), 날짜 등 안정적인 시드로 대체한다. */
export function pickDeterministic<T>(pool: T[], seed: string): T {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}

/** 문자열 시드로부터 [min, max] 범위 안의 결정론적 숫자를 뽑는다 — 게시판 태블릿 뷰의
 * 스티커 랜덤 틸트처럼 "리렌더마다 값이 바뀌면 안 되는" 시각 효과에 쓴다. */
export function seededRange(seed: string, min: number, max: number): number {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const ratio = (hash % 1000) / 1000;
  return min + ratio * (max - min);
}
