"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconPlus, IconPaperclip } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import type { Schedule } from "@/types";

export interface MemberInfo {
  display_name: string;
  avatar_color: string;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

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

export function TodayEvents({
  todaySchedules,
  weekSchedules,
  weekDates,
  membersById,
}: {
  todaySchedules: Schedule[];
  weekSchedules: Schedule[];
  weekDates: string[];
  membersById: Record<string, MemberInfo>;
}) {
  const [tab, setTab] = useState<"today" | "week">("today");
  const [expanded, setExpanded] = useState(false);

  const visibleToday = expanded ? todaySchedules : todaySchedules.slice(0, 3);

  const byDate = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    for (const date of weekDates) map[date] = [];
    for (const s of weekSchedules) {
      if (map[s.date_start]) map[s.date_start].push(s);
    }
    return map;
  }, [weekSchedules, weekDates]);

  return (
    <div className="flex flex-col gap-row">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3">
          {(["today", "week"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-[12px] font-medium ${
                tab === key ? mirror.primary : mirror.muted
              }`}
            >
              {key === "today" ? "오늘" : "이번 주"}
            </button>
          ))}
        </div>
        <Link href="/schedule?new=1" aria-label="특이사항 추가">
          <IconPlus size={16} className={mirror.muted} />
        </Link>
      </div>

      {tab === "today" ? (
        <div className="flex flex-col gap-row">
          {todaySchedules.length === 0 && (
            <p className={`text-[13px] ${mirror.muted}`}>오늘 등록된 일정이 없어요</p>
          )}
          {visibleToday.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <span
                className="w-12 shrink-0 text-[13px]"
                style={{ fontVariantNumeric: "tabular-nums", color: "var(--accent-honey)" }}
              >
                {s.time_start ? s.time_start.slice(0, 5) : "종일"}
              </span>
              <span
                className={`truncate text-[14px] ${
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
          {todaySchedules.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex items-center justify-center"
              aria-label="더보기"
            >
              <IconChevronDown
                size={16}
                className={`transition-transform ${mirror.muted} ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date, i) => {
            const day = new Date(date).getDate();
            const items = byDate[date] ?? [];
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] ${mirror.muted}`}>{WEEKDAY_LABELS[i]}</span>
                <span className={`text-[12px] font-medium ${mirror.primary}`}>{day}</span>
                <div className="flex flex-col items-center gap-0.5">
                  {items.slice(0, 2).map((s) => (
                    <span
                      key={s.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.is_important ? "bg-terra" : "bg-honey"
                      }`}
                    />
                  ))}
                  {items.some((s) => s.memo) && (
                    <IconPaperclip size={10} className={mirror.muted} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
