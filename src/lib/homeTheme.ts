/** 홈 화면 "스마트미러" 스타일 전용 타이포그래피 토큰.
 * 색상은 globals.css의 CSS 변수(--bg-page 등)를 그대로 참조한다(다크 단일 테마 —
 * 라이트 재도입 시 그 변수 값만 복원하면 이 토큰들은 그대로 반응함).
 * 다른 탭(식탁/일정/게시판)은 기존 cream/ink/stone 팔레트를 그대로 쓰므로 영향받지 않는다. */
export const mirror = {
  bg: "bg-[var(--bg-page)]",
  primary: "text-[var(--text-primary)]",
  secondary: "text-[var(--text-secondary)]",
  muted: "text-[var(--text-muted)]",
  hairline: "border-[var(--hairline)]",
  hairlineBg: "bg-[var(--hairline)]",
  label: "text-[12px] tracking-[0.1em] text-[var(--text-muted)]",
} as const;
