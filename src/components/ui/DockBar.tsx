"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconToolsKitchen2, IconCalendar, IconLayoutBoard } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { useTabletHomeReveal } from "@/components/ui/TabletHomeReveal";

const TABS = [
  { href: "/home", label: "홈", icon: IconHome },
  { href: "/food", label: "식탁", icon: IconToolsKitchen2 },
  { href: "/schedule", label: "일정", icon: IconCalendar },
  { href: "/board", label: "게시판", icon: IconLayoutBoard },
];

/** 태블릿 홈 화면(조망 모드)에서만 독바를 기본적으로 숨기고, 화면 어디든 탭하면 3초간
 * 보였다가 다시 사라진다 — 모바일이나 다른 탭에서는 이전과 동일하게 항상 보인다. 이
 * 터치 반응 타이머는 우상단 설정/알림 진입점(TabletTopBar)과 공유한다(TabletHomeReveal). */
export function DockBar() {
  const pathname = usePathname();
  const visible = useTabletHomeReveal();

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 flex h-[var(--dock-h)] items-center justify-around bg-cream pb-[env(safe-area-inset-bottom)] transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 ${
              active ? mirror.primary : mirror.muted
            }`}
          >
            <Icon size={22} stroke={1.75} />
            <span className="text-[13px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
