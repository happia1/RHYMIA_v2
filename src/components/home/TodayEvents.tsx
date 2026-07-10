"use client";

import Link from "next/link";
import { IconPaperclip } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import type { Schedule } from "@/types";

export type { MemberInfo };

/** "오늘 뭐하지" — 오늘 일정만 표시(이번 주 보기는 일정 탭 전담), 최대 3개 + 더보기 */
export function TodayEvents({
  todaySchedules,
  membersById,
}: {
  todaySchedules: Schedule[];
  membersById: Record<string, MemberInfo>;
}) {
  const visible = todaySchedules.slice(0, 3);

  return (
    <div className="flex flex-col gap-row">
      {todaySchedules.length > 0 && (
        <div className="flex flex-col gap-row">
          {visible.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span
                className={`min-w-0 flex-1 truncate text-[14px] ${
                  s.is_important ? "font-medium" : ""
                } ${mirror.primary}`}
              >
                {s.title}
              </span>
              <span
                className="shrink-0 rounded-full bg-honey/10 px-1.5 py-0.5 text-[11px] text-honey"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {s.time_start ? s.time_start.slice(0, 5) : "종일"}
              </span>
              {s.memo && <IconPaperclip size={12} className={`shrink-0 ${mirror.muted}`} />}
              <span className={`shrink-0 text-[11px] ${mirror.muted}`}>
                {targetLabel(s.target_members, membersById)}
              </span>
            </div>
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
