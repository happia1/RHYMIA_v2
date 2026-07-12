"use client";

import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";

/** 일정 탭 월간 뷰의 키워드 색 범례 — 달력 상단 월 이동 줄("< 2026년 7월 >")의 왼쪽에
 * 드롭다운 토글로 접어둔다(MemberFilterRow와 같은 줄 오른쪽에 놓인 "전체 ▾"와 짝을 이룸). */
export function KeywordLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 text-[10px] tracking-[0.1em] text-[var(--text-muted)]"
      >
        키워드
        <IconChevronDown size={11} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <>
          <button aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-40" />
          <div className="absolute left-0 top-full z-50 mt-1.5 flex min-w-24 flex-col gap-1.5 rounded-xl border border-border-light bg-surface p-2.5 shadow-sm">
            {KEYWORD_GROUPS.map((g) => (
              <span key={g.main} className="flex items-center gap-1.5 text-[11px] text-stone">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                {g.main}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
