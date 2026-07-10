/** 문자열 시드로부터 결정론적(서버/클라이언트 동일 결과)으로 풀에서 하나를 뽑는다.
 * 클라이언트 컴포넌트 첫 렌더에서 Math.random()을 쓰면 SSR과 하이드레이션 결과가
 * 달라질 수 있어(hydration mismatch), 날짜 등 안정적인 시드로 대체한다. */
export function pickDeterministic<T>(pool: T[], seed: string): T {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}
