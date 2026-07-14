/** 모든 슬라이드 팝업(시트)이 공유하는 헤더 — 제목 좌측, 액션(저장/수정/삭제 등) 우측.
 * 개별 시트가 자기만의 헤더 마크업을 만들지 않도록 이 컴포넌트로 강제 통일한다.
 * 액션은 `SheetHeaderAction`을 나란히 넣으면 되고, 없으면 제목만 뜬다. */
export function SheetHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="min-w-0 flex-1 truncate text-[17px] font-medium text-ink">{title}</h2>
      {children && <div className="flex shrink-0 items-center gap-4">{children}</div>}
    </div>
  );
}

const TONE_CLASS = {
  honey: "text-honey",
  terra: "text-terra",
  stone: "text-stone",
} as const;

/** SheetHeader 우측에 놓는 텍스트 액션 버튼 — "저장"(honey), "삭제"(terra) 등. */
export function SheetHeaderAction({
  label,
  onClick,
  tone = "honey",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone?: keyof typeof TONE_CLASS;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[14px] font-medium disabled:opacity-40 ${TONE_CLASS[tone]}`}
    >
      {label}
    </button>
  );
}
