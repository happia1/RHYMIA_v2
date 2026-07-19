"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useDeviceLayout } from "@/lib/useDeviceLayout";

const REVEAL_MS = 3000;
const RevealContext = createContext<boolean | null>(null);

/** 태블릿 홈(조망 모드)에서만 동작하는 "화면 탭 → 3초간 표시 → 페이드아웃" 공유 타이머 —
 * 하단 DockBar와 우상단 설정/알림 진입점(TabletTopBar)이 같은 타이밍으로 함께 나타났다
 * 사라져야 해서(따로 두 타이머를 각자 두면 미세하게 어긋날 수 있음), 여기 하나만 두고
 * 두 컴포넌트가 공유한다. `(main)/layout.tsx`에서 `{children}`(→ 결국 HomeTabletHome)과
 * `<DockBar />` 둘 다를 감싸야 두 쪽 다 이 컨텍스트를 볼 수 있다. 조망 상태(터치 전)에는
 * 원칙대로 둘 다 안 보인다. 모바일/다른 탭에서는 이 조건 자체가 꺼져 있어 항상 보임
 * (기존 DockBar 동작과 동일). */
export function TabletHomeRevealProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { layout } = useDeviceLayout();
  const isTabletHome = layout !== "mobile" && pathname === "/home";

  const [visible, setVisible] = useState(!isTabletHome);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(!isTabletHome);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isTabletHome]);

  useEffect(() => {
    if (!isTabletHome) return;

    const reveal = () => {
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), REVEAL_MS);
    };

    document.addEventListener("pointerdown", reveal);
    return () => {
      document.removeEventListener("pointerdown", reveal);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };
  }, [isTabletHome]);

  return <RevealContext.Provider value={visible}>{children}</RevealContext.Provider>;
}

export function useTabletHomeReveal() {
  const ctx = useContext(RevealContext);
  if (ctx === null) throw new Error("useTabletHomeReveal must be used within TabletHomeRevealProvider");
  return ctx;
}
