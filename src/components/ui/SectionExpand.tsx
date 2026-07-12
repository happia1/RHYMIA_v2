"use client";

import { useRef, useState } from "react";

const SWIPE_THRESHOLD = 40;

/** 데이터가 계속 쌓이는 리스트형 섹션의 공용 패턴 — 전체 항목을 pageSize개씩 페이지로 나누고,
 * 하단에 페이지 번호(1,2,3...)를 두어 탭하거나 좌우로 스와이프해서 넘긴다. 페이지가 1개뿐이면
 * 번호는 표시하지 않는다. */
export function SectionExpand<T>({
  items,
  pageSize,
  renderItem,
}: {
  items: T[];
  pageSize: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  const goTo = (next: number) => setPage(Math.max(0, Math.min(pageCount - 1, next)));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD) goTo(currentPage + 1);
    else if (delta >= SWIPE_THRESHOLD) goTo(currentPage - 1);
  };

  return (
    <div>
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex flex-col"
      >
        {pageItems.map((item, i) => renderItem(item, i))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}페이지`}
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-medium ${
                i === currentPage ? "bg-honey text-white" : "text-[var(--text-muted)]"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
