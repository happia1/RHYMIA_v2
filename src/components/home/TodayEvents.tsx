"use client";

import Link from "next/link";
import { IconPaperclip } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import type { Schedule } from "@/types";

/** "오늘 뭐하지" — 오늘 일정만 표시(이번 주 보기는 일정 탭 전담), 최대 3개 + 더보기.
 * 시간("종일")/대상("가족") 텍스트는 홈에서는 노출하지 않고 제목만 보여준다
 * (자세한 내용은 일정 탭에서 확인 — 홈은 한눈에 훑는 용도). */
export function TodayEvents({ todaySchedules }: { todaySchedules: Schedule[] }) {
  const visible = todaySchedules.slice(0, 3);

  return (
    <div className="flex flex-col gap-row">
      {todaySchedules.length > 0 && (
        <div className="flex flex-col gap-row">
          {visible.map((s) => (
            <Link
              key={s.id}
              href={`/schedule?view=month&date=${s.date_start}&highlight=${s.id}`}
              className="flex items-center gap-2"
            >
              <span
                className={`min-w-0 flex-1 truncate text-[11px] ${
                  s.is_important ? "font-medium" : ""
                } ${mirror.primary}`}
              >
                {s.title}
              </span>
              {s.memo && <IconPaperclip size={11} className={`shrink-0 ${mirror.muted}`} />}
            </Link>
          ))}
        </div>
      )}

      {todaySchedules.length > 3 && (
        <Link href="/schedule" className={`self-end text-[11px] ${mirror.muted}`}>
          더보기
        </Link>
      )}
    </div>
  );
}
