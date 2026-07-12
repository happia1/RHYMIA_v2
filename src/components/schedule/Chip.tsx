"use client";

/** 일정 탭 전반에서 재사용하는 단일 선택형 칩(요일 칩, 멤버 필터 칩 등) — 활성 시
 * ink 배경/cream 텍스트, 비활성 시 옅은 배경/stone 텍스트로 통일한다. */
export function Chip({
  label,
  active,
  onClick,
  color,
  className = "px-3",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** 지정하면 라벨 앞에 작은 색 점을 붙인다 — 멤버 아바타 색 등 "사람은 색으로" 구분용 */
  color?: string;
  /** 크기/여백 오버라이드 — 요일 칩처럼 고정 폭 원형이 필요하면 "w-8 px-0" 등으로 전달 */
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full text-[12px] font-medium ${className} ${
        active ? "bg-ink text-cream" : "bg-surface text-stone"
      }`}
    >
      {color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}
