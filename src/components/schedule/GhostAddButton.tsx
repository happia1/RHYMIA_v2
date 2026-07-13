"use client";

import { IconPlus } from "@tabler/icons-react";

/** 월간·주간 뷰의 할 일/일정 칸이 비어 있을 때만 나타나는 흐린 "+" — 내용이 있는 칸에는
 * 아예 렌더하지 않는다(상주 아이콘 금지 원칙, 추가는 이 고스트나 하단 FAB로만). */
export function GhostAddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="self-start p-1 -m-1 text-[var(--text-muted)] opacity-40"
    >
      <IconPlus size={12} />
    </button>
  );
}
