"use client";

import Link from "next/link";
import { IconBell, IconSettings } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { useTabletHomeReveal } from "@/components/ui/TabletHomeReveal";

/** 태블릿 홈(조망 모드) 우상단 설정/알림 진입점 — 하단 DockBar와 같은 터치 반응 타이머를
 * 공유해(useTabletHomeReveal) 화면을 탭하면 3초간 함께 나타났다 페이드아웃된다. 조망
 * 상태(터치 전)에는 원칙대로 아무것도 안 보인다. HomeTabletHome의 relative 컨테이너
 * 안에서 절대 위치로 배치된다. */
export function TabletTopBar() {
  const visible = useTabletHomeReveal();

  return (
    <div
      className={`absolute right-0 top-0 z-40 flex items-center gap-4 transition-opacity duration-300 ${
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <Link href="/notifications" aria-label="알림">
        <IconBell size={22} className={mirror.secondary} />
      </Link>
      <Link href="/settings" aria-label="설정">
        <IconSettings size={22} className={mirror.secondary} />
      </Link>
    </div>
  );
}
