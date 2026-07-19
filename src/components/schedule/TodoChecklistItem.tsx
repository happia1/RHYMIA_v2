"use client";

import { IconCheck } from "@tabler/icons-react";
import type { Todo } from "@/types";

/** 월간·주간 뷰가 공유하는 할 일 한 줄 — 상주 아이콘(연필) 없이 문법만으로 조작한다:
 * 체크 원 탭 = 완료 토글(패딩으로 탭 영역을 시각적 크기보다 넉넉히 확보), 텍스트 탭 = 수정
 * 시트(TodoSheet, existingTodo 모드) 오픈. 두 영역을 각각 별도 버튼으로 분리해야 클릭이
 * 서로 겹쳐 토글이 이중으로 발동하는 걸 막을 수 있다. */
export function TodoChecklistItem({
  todo,
  onToggle,
  onOpenEdit,
}: {
  todo: Todo;
  onToggle: () => void;
  onOpenEdit: () => void;
}) {
  return (
    <div className="flex items-start gap-1.5 py-1">
      <button onClick={onToggle} aria-label="완료 토글" className="shrink-0 p-1.5 -m-1.5">
        <span
          className={`flex h-3 w-3 items-center justify-center rounded-full border ${
            todo.is_done ? "border-sage bg-sage" : "border-border-light"
          }`}
        >
          {todo.is_done && <IconCheck size={8} className="text-white" stroke={3} />}
        </span>
      </button>
      <button onClick={onOpenEdit} className="min-w-0 flex-1 text-left">
        <span
          className={`line-clamp-2 break-words text-[12px] ${
            todo.is_done ? "text-[var(--text-muted)] line-through" : "text-ink"
          }`}
        >
          {todo.title}
        </span>
      </button>
    </div>
  );
}
