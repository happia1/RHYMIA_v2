"use client";

import type { ReactNode } from "react";
import { useDeviceLayout } from "@/lib/useDeviceLayout";

/** 홈/식탁/일정/게시판 4개 탭 page.tsx의 최상위 컨테이너 — 평소엔 100dvh에 고정하고
 * overflow-hidden으로 페이지 자체 스크롤을 막은 채 내부 영역(ScrollRegion)만 스크롤하게
 * 하지만, 폰을 가로로 눕히면(useDeviceLayout의 isPhoneLandscape) 그 고정 원칙을 풀어
 * min-height만 두고 자연 스크롤을 허용한다 — 레이아웃 재배치는 하지 않고 스크롤 동작만
 * 바뀐다. 탭마다 따로 판단하지 않도록 이 컴포넌트 하나로 통일. */
export function TabPageFrame({ className = "", children }: { className?: string; children: ReactNode }) {
  const { isPhoneLandscape } = useDeviceLayout();
  return (
    <div
      className={`flex flex-col ${
        isPhoneLandscape
          ? "min-h-[calc(100dvh-var(--dock-h))]"
          : "h-[calc(100dvh-var(--dock-h))] overflow-hidden"
      } ${className}`}
    >
      {children}
    </div>
  );
}
