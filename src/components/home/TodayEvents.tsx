"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconPlus, IconPaperclip } from "@tabler/icons-react";
import { TagChip } from "@/components/ui/TagChip";
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
  if (targetMembers.length === 0) return { label: "가족", color: "#888780" };
  if (targetMembers.length === 1) {
    const m = membersById[targetMembers[0]];
    return { label: m?.display_name ?? "가족", color: m?.avatar_color ?? "#888780" };
  }
  return { label: `가족 외 ${targetMembers.length}`, color: "#888780" };
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
    <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-stone">오늘 뭐하지?</span>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-cream p-0.5">
            {(["today", "week"] as const).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium ${
                  tab === key ? "bg-white text-ink" : "text-stone"
                }`}
              >
                {key === "today" ? "오늘" : "이번 주"}
              </button>
            ))}
          </div>
          <Link href="/schedule?new=1" aria-label="특이사항 추가">
            <IconPlus size={18} className="text-stone" />
          </Link>
        </div>
      </div>

      {tab === "today" ? (
        <div className="flex flex-col gap-2">
          {todaySchedules.length === 0 && (
            <p className="text-[13px] text-stone">오늘 등록된 일정이 없어요</p>
          )}
          {visibleToday.map((s) => {
            const target = targetLabel(s.target_members, membersById);
            return (
              <div key={s.id} className="flex items-center gap-2">
                <TagChip label={target.label} color={target.color} />
                <span
                  className={`truncate text-[13px] ${
                    s.is_important ? "font-medium text-terra" : "text-ink"
                  }`}
                >
                  {s.title}
                </span>
                {s.supplies && (
                  <IconPaperclip size={14} className="shrink-0 text-stone" />
                )}
              </div>
            );
          })}
          {todaySchedules.length > 3 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 flex items-center justify-center"
              aria-label="더보기"
            >
              <IconChevronDown
                size={18}
                className={`text-stone transition-transform ${
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
                <span className="text-[10px] text-stone">{WEEKDAY_LABELS[i]}</span>
                <span className="text-[12px] font-medium text-ink">{day}</span>
                <div className="flex flex-col items-center gap-0.5">
                  {items.slice(0, 2).map((s) => (
                    <span
                      key={s.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.is_important ? "bg-terra" : "bg-ocean"
                      }`}
                    />
                  ))}
                  {items.some((s) => s.supplies) && (
                    <IconPaperclip size={10} className="text-stone" />
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
