"use client";

import { useEffect, useRef, useState } from "react";

// 이보다 짧게 움직인 터치는 스크롤/탭으로 간주하고 이동을 트리거하지 않는다.
const SWIPE_NAV_THRESHOLD_PX = 40;

/** 월간/주간/연간 뷰가 공유하는 좌우 스와이프 내비게이션 — 손가락을 따라 실시간으로
 * 콘텐츠를 끌어당기다(dragX) 놓았을 때 임계값을 넘기면 onPrev/onNext를 호출한다.
 * `value`(월간=anchorDate, 주간=주 시작일, 연간=연도)가 실제로 바뀌면(스와이프든 기존
 * <> 버튼 클릭이든 경로 무관) 이전 값과 비교해 방향을 판정해 slideDir을 세팅 —
 * 호출부는 이 값으로 새 콘텐츠가 어느 쪽에서 미끄러져 들어올지 결정한다(마운트 시
 * 재생되는 CSS 애니메이션, globals.css의 calendar-slide-in-*). 데이 시트 등 다른
 * 시트가 열려 있을 땐 disabled로 넘겨 제스처 충돌을 막는다. */
export function useSwipeCalendarNav({
  value,
  onPrev,
  onNext,
  disabled = false,
}: {
  value: string | number;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [slideDir, setSlideDir] = useState<1 | -1 | 0>(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setSlideDir(value > prevValue.current ? 1 : -1);
      prevValue.current = value;
    }
  }, [value]);

  const reset = () => {
    touchStart.current = null;
    setDragging(false);
    setDragX(0);
  };

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      if (disabled) return;
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setDragging(true);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (disabled || !touchStart.current) return;
      const dx = e.touches[0].clientX - touchStart.current.x;
      const dy = e.touches[0].clientY - touchStart.current.y;
      // 세로 움직임이 더 크면(스크롤 의도) 가로 스와이프로 취급하지 않는다.
      if (Math.abs(dy) > Math.abs(dx)) return;
      setDragX(dx);
    },
    onTouchEnd: () => {
      if (disabled || !touchStart.current) {
        reset();
        return;
      }
      const finalDragX = dragX;
      reset();
      if (finalDragX <= -SWIPE_NAV_THRESHOLD_PX) onNext();
      else if (finalDragX >= SWIPE_NAV_THRESHOLD_PX) onPrev();
    },
  };

  return { dragX, dragging, slideDir, handlers };
}

/** useSwipeCalendarNav의 dragX/dragging/slideDir을 그대로 꽂아 쓰는 공용 인라인 스타일 —
 * 드래그 중엔 손가락을 1:1로 따라가고(트랜지션 없음), 손을 떼서 실제로 이동했으면
 * 그 방향에서 미끄러져 들어오는 CSS 애니메이션(globals.css)을 재생한다. 세 뷰 모두
 * 이 스타일을 콘텐츠 컨테이너에 그대로 얹으면 된다(개별 애니메이션 구현 금지). */
export function swipeCalendarNavStyle({
  dragging,
  dragX,
  slideDir,
}: Pick<ReturnType<typeof useSwipeCalendarNav>, "dragging" | "dragX" | "slideDir">): React.CSSProperties {
  if (dragging) {
    return { transform: `translateX(${dragX}px)`, transition: "none" };
  }
  if (slideDir !== 0) {
    return { animation: `calendar-slide-in-${slideDir === 1 ? "right" : "left"} 220ms ease-out` };
  }
  return {};
}
