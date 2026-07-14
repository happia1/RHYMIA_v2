"use client";

import { useEffect, useState } from "react";
import { useSwipeDownToClose } from "@/components/ui/useSwipeDownToClose";

export function BottomSheet({
  open,
  onClose,
  children,
  tall = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 장보기 시트처럼 더 높은 높이가 필요할 때 — 92dvh (기본 85vh) */
  tall?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const { dragY, dragging, handlers } = useSwipeDownToClose(onClose);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
      onTransitionEnd={() => {
        if (!open) setMounted(false);
      }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        {...handlers}
        className={`relative z-10 flex w-full flex-col overflow-y-auto rounded-t-3xl bg-surface p-6 ${
          dragging ? "" : "transition-transform duration-200"
        } ${tall ? "max-h-[92dvh]" : "max-h-[85vh]"} ${open ? "translate-y-0" : "translate-y-full"}`}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-[#E8E6E0]" />
        {children}
      </div>
    </div>
  );
}
