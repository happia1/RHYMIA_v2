"use client";

import Link from "next/link";
import { IconPlus, IconPaperclip } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import type { Schedule } from "@/types";

export interface MemberInfo {
  display_name: string;
  avatar_color: string;
}

function targetLabel(
  targetMembers: string[],
  membersById: Record<string, MemberInfo>
) {
  if (targetMembers.length === 0) return "가족";
  if (targetMembers.length === 1) {
    return membersById[targetMembers[0]]?.display_name ?? "가족";
  }
  return `가족 외 ${targetMembers.length}`;
}

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
      <div className="flex items-center justify-end">
        <Link href="/schedule?new=1" aria-label="특이사항 추가">
          <IconPlus size={16} className={mirror.muted} />
        </Link>
      </div>

      {todaySchedules.length === 0 ? (
        <p className={`text-[13px] ${mirror.muted}`}>오늘 등록된 일정이 없어요</p>
      ) : (
        <div className="flex flex-col gap-row">
          {visible.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <span
                className="w-12 shrink-0 text-[13px]"
                style={{ fontVariantNumeric: "tabular-nums", color: "var(--accent-honey)" }}
              >
                {s.time_start ? s.time_start.slice(0, 5) : "종일"}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[14px] ${
                  s.is_important ? "font-medium" : ""
                } ${mirror.primary}`}
              >
                {s.title}
              </span>
              {s.memo && <IconPaperclip size={12} className={`shrink-0 ${mirror.muted}`} />}
              <span className={`ml-auto shrink-0 text-[11px] ${mirror.muted}`}>
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
