"use client";

import { useState } from "react";
import { IconX } from "@tabler/icons-react";

/** 데이터가 계속 쌓이는 리스트형 섹션의 공용 패턴 — 기본은 앞의 N개만 보여주고,
 * "더보기"를 누르면 섹션 내부에서 펼치는 대신 전용 풀스크린 뷰로 전환한다(내부 스크롤은
 * 허용하되 스크롤바는 숨김, `scrollbar-hide` 유틸 재사용). 홈 외 탭(식탁/일정/게시판)의
 * "페이지 세로 스크롤 없음" 원칙을 지키면서도 목록 전체를 볼 수 있게 하기 위한 것. */
export function SectionExpand<T>({
  items,
  previewCount,
  title,
  renderItem,
}: {
  items: T[];
  previewCount: number;
  title: string;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = items.slice(0, previewCount);
  const overflowCount = items.length - preview.length;

  return (
    <>
      <div className="flex flex-col">
        {preview.map((item, i) => renderItem(item, i))}
        {overflowCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="self-end pt-1.5 text-[11px] text-[var(--text-muted)]"
          >
            더보기 · 외 {overflowCount}개
          </button>
        )}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-cream">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-light px-4">
            <span className="text-[15px] font-medium text-ink">{title}</span>
            <button onClick={() => setExpanded(false)} aria-label="닫기">
              <IconX size={22} className="text-ink" />
            </button>
          </header>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            <div className="flex flex-col">{items.map((item, i) => renderItem(item, i))}</div>
          </div>
        </div>
      )}
    </>
  );
}
