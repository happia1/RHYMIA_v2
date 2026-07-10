"use client";

import { useState } from "react";
import Link from "next/link";
import { RoutineWheel } from "@/components/schedule/RoutineWheel";
import { STATUS_EMOJI, DEFAULT_STATUS_EMOJI } from "@/lib/routineUtils";
import type { RoutineBlock } from "@/types";

const WHEEL_SIZE = 120;

/** 일정 탭 상단 — 기존 "상태 텍스트 + 내 루틴 링크"를 대체하는 좌우 2단 위젯.
 * 루틴을 안 쓰는 멤버는 도넛 차트 없이 한 줄짜리 축소 형태로 보여준다. */
export function RoutineTopWidget({
  blocks,
  currentBlock,
  routineEnabled,
}: {
  blocks: RoutineBlock[];
  currentBlock: RoutineBlock | null;
  routineEnabled: boolean;
}) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  if (!routineEnabled) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--text-muted)]">
          루틴을 설정하면 내 하루가 여기 표시돼요
        </span>
        <Link href="/schedule/routine" className="shrink-0 text-[13px] font-medium text-ink">
          설정하기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0">
        <RoutineWheel
          blocks={blocks}
          highlightedIndex={highlightedIndex}
          onSelectBlock={setHighlightedIndex}
          size={WHEEL_SIZE}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {currentBlock ? (
          <span className="truncate text-[17px] font-medium text-ink">
            {STATUS_EMOJI[currentBlock.status] ?? DEFAULT_STATUS_EMOJI} {currentBlock.label} ·{" "}
            {currentBlock.start}~{currentBlock.end}
          </span>
        ) : (
          <span className="text-[28px] leading-none">{DEFAULT_STATUS_EMOJI}</span>
        )}
        <Link href="/schedule/routine" className="self-start text-[13px] font-medium text-[var(--text-muted)]">
          설정
        </Link>
      </div>
    </div>
  );
}
