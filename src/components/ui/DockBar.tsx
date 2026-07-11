"use client";

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

export function DockBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[64px] items-center justify-around bg-cream">
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
