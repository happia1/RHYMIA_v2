"use client";

import { useRef, useState } from "react";

// 이보다 많이(px) 끌어내리면 스와이프로 닫힘 처리.
const SWIPE_CLOSE_THRESHOLD_PX = 70;

/** 모든 슬라이드 팝업(시트)이 공유하는 "아래로 스와이프해서 닫기" 로직 — 드래그 중엔 손가락을
 * 1:1로 따라가다(트랜지션 끔) 놓으면 임계값 초과 시 onClose, 아니면 0으로 스냅백(트랜지션
 * 다시 켬). `BottomSheet.tsx`(모달형)와 `DaySheet.tsx`(비모달형, 달력 위에 뜨는 시트)처럼
 * 렌더 구조가 다른 시트들도 이 훅 하나로 드래그 계산만 공유하고 각자의 마크업에
 * `handlers`/`dragY`/`dragging`을 꽂아 쓴다.
 *
 * 스크롤 가능한 긴 폼이 든 시트에서 "위로 스크롤하려고 아래로 끄는" 제스처가 그대로
 * 닫힘으로 오인되지 않도록, 터치 시작 시점에 그 스크롤 컨테이너가 맨 위(scrollTop<=0)일
 * 때만 드래그를 "무장"한다 — 이미 스크롤된 상태에서의 하향 드래그는 무시하고 평소처럼
 * 콘텐츠 스크롤에 맡긴다. */
export function useSwipeDownToClose(onClose: () => void) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const armed = useRef(false);

  const handlers = {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      touchStartY.current = e.touches[0].clientY;
      armed.current = e.currentTarget.scrollTop <= 0;
      setDragging(true);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (touchStartY.current === null || !armed.current) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) setDragY(delta);
    },
    onTouchEnd: () => {
      touchStartY.current = null;
      armed.current = false;
      setDragging(false);
      if (dragY > SWIPE_CLOSE_THRESHOLD_PX) onClose();
      setDragY(0);
    },
  };

  return { dragY, dragging, handlers };
}
