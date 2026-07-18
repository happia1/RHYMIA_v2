"use client";

import { useEffect, useRef, useState } from "react";
import { mirror } from "@/lib/homeTheme";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { Notice } from "@/types";

const ROTATE_MS = 4000;
// 이보다 좌우로 더 끌었을 때만 스와이프로 인정 — 살짝 스친 정도로는 안 넘어가게.
const SWIPE_THRESHOLD_PX = 40;

/** 홈 헤더 "공지" 배너 — 게시판 메모 중 고정(is_pinned)한 것을 테두리 블록 카드 1장씩
 * 보여준다. 여러 건이면 4초 간격으로 좌→우 가로 슬라이드로 자동 전환되고, 좌우 스와이프로
 * 수동 이동도 가능하다. 터치 중엔 자동 전환용 타이머 자체를 꺼서(isPaused) 읽는 도중
 * 카드가 바뀌는 일이 없게 하고, 손을 떼면 그 시점부터 다시 4초를 센다. */
export function PinnedNoticeBanner({
  memos,
  membersById,
  onSelect,
}: {
  memos: Notice[];
  membersById: Record<string, WorkspaceMemberInfo>;
  onSelect: (memo: Notice) => void;
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // 카드 목록이 바뀌면(다른 메모가 고정/해제되는 등) 인덱스가 범위를 벗어날 수 있어 안전하게 맞춘다.
  useEffect(() => {
    setIndex((i) => (memos.length === 0 ? 0 : i % memos.length));
  }, [memos.length]);

  useEffect(() => {
    if (memos.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % memos.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [memos.length, isPaused]);

  if (memos.length === 0) return null;

  const current = memos[index];
  const author = current.created_by ? membersById[current.created_by] : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (!touchStart.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    // 세로 움직임이 더 크면(스크롤 의도) 스와이프로 취급하지 않는다.
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (memos.length <= 1) return;

    if (deltaX < 0) {
      setDirection(1);
      setIndex((i) => (i + 1) % memos.length);
    } else {
      setDirection(-1);
      setIndex((i) => (i - 1 + memos.length) % memos.length);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        key={current.id}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => onSelect(current)}
        style={{
          animation:
            memos.length > 1
              ? `notice-slide-in-${direction === 1 ? "right" : "left"} 280ms ease-out`
              : undefined,
        }}
        className={`flex h-14 w-full cursor-pointer items-center gap-2.5 rounded-xl border-[0.5px] px-3 ${mirror.hairline}`}
      >
        {current.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.image_url}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md object-cover"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className={`line-clamp-2 text-[14px] font-medium leading-snug ${mirror.primary}`}>
            {current.content}
          </p>
          <span className={`text-[11px] ${mirror.muted}`}>
            {author?.display_name ?? "가족"}
          </span>
        </div>
      </div>

      {memos.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {memos.map((m, i) => (
            <span
              key={m.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-4 bg-honey" : `w-1.5 ${mirror.hairlineBg}`
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
