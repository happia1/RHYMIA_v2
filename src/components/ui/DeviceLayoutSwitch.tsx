"use client";

import type { ReactNode } from "react";
import { useDeviceLayout } from "@/lib/useDeviceLayout";

/** 각 탭 page.tsx(서버 컴포넌트)가 모바일/태블릿 마크업을 각각 그대로 넘기면, 이 컴포넌트가
 * useDeviceLayout() 하나로 어느 쪽을 렌더할지 결정한다 — 탭마다 `lg:hidden`/`hidden lg:block`
 * 같은 미디어쿼리 클래스를 반복해서 넣지 않기 위한 공용 스위치(이미 클라이언트 컴포넌트인
 * MonthView/BoardSection/HomeTabletHome 등은 이 래퍼 없이 useDeviceLayout()을 직접 호출한다). */
export function DeviceLayoutSwitch({ mobile, tablet }: { mobile: ReactNode; tablet: ReactNode }) {
  const { layout } = useDeviceLayout();
  return <>{layout === "mobile" ? mobile : tablet}</>;
}
