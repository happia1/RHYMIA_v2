"use client";

import type { ReactNode } from "react";
import { useDeviceLayout } from "@/lib/useDeviceLayout";

/** TabPageFrame과 세트로 쓰는 "min-h-0 flex-1 overflow-y-auto"(고정 높이 안에서만 내부
 * 스크롤) 패턴의 공용 래퍼 — 폰 가로 짧은 화면(isPhoneLandscape)에서는 이 안쪽 스크롤
 * 상자를 풀어 전체 페이지가 자연스럽게 늘어나며 스크롤되게 한다. `lockOverflow`는 일정
 * 월간 뷰의 압축(날짜 탭 시 50%로 줄어드는) 애니메이션처럼 평소엔 overflow-hidden이어야
 * 하는 구간 전용 — 그 경우도 폰 가로일 땐 똑같이 풀어준다. */
export function ScrollRegion({
  className = "",
  lockOverflow = false,
  children,
}: {
  className?: string;
  lockOverflow?: boolean;
  children: ReactNode;
}) {
  const { isPhoneLandscape } = useDeviceLayout();
  const scrollClasses = isPhoneLandscape
    ? ""
    : lockOverflow
      ? "min-h-0 flex-1 overflow-hidden"
      : "min-h-0 flex-1 overflow-y-auto";
  return <div className={`${className} ${scrollClasses}`}>{children}</div>;
}
