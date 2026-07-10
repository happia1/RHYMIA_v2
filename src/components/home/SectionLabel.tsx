"use client";

import { IconPlus } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";

export function SectionLabel({
  icon,
  children,
  onAdd,
  addLabel = "추가",
}: {
  /** 미리 렌더링된 아이콘 엘리먼트(예: `<IconCalendar size={14} />`)를 전달 — 컴포넌트
   * 참조 자체(`IconCalendar`)를 넘기면 서버 컴포넌트에서 이 클라이언트 컴포넌트로 props를
   * 넘길 때 직렬화할 수 없어 런타임 에러가 남("Functions cannot be passed directly..."). */
  icon: React.ReactNode;
  children: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className={`flex items-center gap-1.5 ${mirror.label}`}>
        {icon}
        <span>{children}</span>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          aria-label={addLabel}
          className={`flex h-11 w-11 items-center justify-center ${mirror.muted}`}
        >
          <IconPlus size={18} />
        </button>
      )}
    </div>
  );
}
