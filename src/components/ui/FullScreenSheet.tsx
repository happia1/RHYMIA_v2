"use client";

import { useEffect, useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { useSwipeDownToClose } from "@/components/ui/useSwipeDownToClose";

/** 게시판 "메모/공지사항" 상세처럼 화면 전체(100dvh)를 덮는 슬라이드 팝업 — 부분 높이에
 * 둥근 모서리를 쓰는 BottomSheet와 달리 좌상단에 "이전으로" 버튼을 둔 전체화면 페이지
 * 느낌을 낸다. 실제 라우팅 이동은 아니라 닫으면 원래 화면에 그대로 남는다. 아래로
 * 스와이프해서 닫는 것도 다른 시트들과 동일하게 지원(useSwipeDownToClose 공유). */
export function FullScreenSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const { dragY, dragging, handlers } = useSwipeDownToClose(onClose);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      {...handlers}
      onTransitionEnd={() => {
        if (!open) setMounted(false);
      }}
      className={`fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-y-auto bg-surface ${
        dragging ? "" : "transition-transform duration-200"
      } ${open ? "translate-y-0" : "translate-y-full"}`}
      style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <div className="flex shrink-0 items-center p-4">
        <button onClick={onClose} aria-label="이전으로" className="-m-1 p-1 text-ink">
          <IconArrowLeft size={22} />
        </button>
      </div>
      <div className="min-w-0 flex-1 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
