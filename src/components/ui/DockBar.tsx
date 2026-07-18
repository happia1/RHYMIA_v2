"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconToolsKitchen2, IconCalendar, IconLayoutBoard } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";

const TABS = [
  { href: "/home", label: "홈", icon: IconHome },
  { href: "/food", label: "식탁", icon: IconToolsKitchen2 },
  { href: "/schedule", label: "일정", icon: IconCalendar },
  { href: "/board", label: "게시판", icon: IconLayoutBoard },
];

const REVEAL_MS = 3000;
const TABLET_QUERY = "(min-width: 1024px)";

/** 태블릿 홈 화면에서만 독바를 기본적으로 숨기고, 화면 어디든 탭하면 3초간 보였다가 다시
 * 사라진다(태블릿 스펙의 "화면 탭 → 독바 표시" 동작) — 모바일이나 다른 탭에서는 이전과
 * 동일하게 항상 보인다. document 전역에 pointerdown을 듣기 때문에 탭 위치는 상관없다. */
function useTabletHomeAutoHide(active: boolean) {
  const [visible, setVisible] = useState(!active);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisible(!active);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

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
  }, [active]);

  return visible;
}

export function DockBar() {
  const pathname = usePathname();
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(TABLET_QUERY);
    const update = () => setIsTablet(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isTabletHome = isTablet && pathname === "/home";
  const visible = useTabletHomeAutoHide(isTabletHome);

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 flex h-[64px] items-center justify-around bg-cream transition-opacity duration-300 ${
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
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
