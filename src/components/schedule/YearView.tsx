"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import type { ExpandedSchedule } from "@/lib/recurrence";

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

export function YearView({
  anchorDate,
  schedules,
  membersById,
  keywordMain,
  workspaceId,
}: {
  anchorDate: string;
  schedules: ExpandedSchedule[];
  membersById: Record<string, MemberInfo>;
  keywordMain?: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const year = new Date(anchorDate).getFullYear();
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);

  // MonthView의 KeywordFilterRow와 같은 keywordMain URL 파라미터를 공유한다 —
  // schedule/page.tsx가 뷰 종류와 무관하게 이 파라미터로 schedules를 걸러서 내려주므로,
  // 여기서 고른 키워드는 월간 뷰로 전환해도 그대로 유지된다(기존 scope/target 필터와 동일한 방식).
  const setKeyword = (value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete("keywordMain");
    else next.set("keywordMain", value);
    next.delete("keywordSub");
    router.push(`/schedule?${next.toString()}`);
  };

  const countByMonth: Record<number, number> = {};
  for (const s of schedules) {
    const m = new Date(s.date_start).getMonth();
    countByMonth[m] = (countByMonth[m] ?? 0) + 1;
  }

  const importantSchedules = schedules
    .filter((s) => s.is_important)
    .sort((a, b) => (a.date_start < b.date_start ? -1 : 1));

  const totalAmount = importantSchedules.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-y-4 text-center">
        {Array.from({ length: 12 }, (_, m) => {
          const dateStr = `${year}-${String(m + 1).padStart(2, "0")}-01`;
          const count = countByMonth[m] ?? 0;
          return (
            <Link
              key={m}
              href={`/schedule?view=month&date=${dateStr}`}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-[13px] font-medium text-ink">{m + 1}월</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {count > 0 ? `일정 ${count}건` : "-"}
              </span>
            </Link>
          );
        })}
      </div>

      <div className={`h-px w-full bg-border-light`} />

      <div className="flex flex-col gap-3">
        <span className="text-[12px] font-medium text-[var(--text-muted)]">연간 주요 일정</span>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setKeyword(null)}
            className={`text-[12px] font-medium ${
              !keywordMain ? "text-ink" : "text-[var(--text-muted)]"
            }`}
          >
            전체
          </button>
          {KEYWORD_GROUPS.map((g) => (
            <button
              key={g.main}
              onClick={() => setKeyword(keywordMain === g.main ? null : g.main)}
              className="text-[12px] font-medium"
              style={{ color: keywordMain === g.main ? g.color : "var(--text-muted)" }}
            >
              {g.main}
            </button>
          ))}
        </div>

        <span className="text-[12px] text-[var(--text-muted)]">
          {importantSchedules.length}건{totalAmount > 0 ? ` · 합계 ${won(totalAmount)}` : ""}
        </span>

        {importantSchedules.length === 0 && (
          <p className="text-[13px] text-[var(--text-muted)]">등록된 주요 일정이 없어요</p>
        )}
        {importantSchedules.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setEditingSchedule(s)}
            className={`flex items-center gap-3 py-2.5 text-left ${
              i > 0 ? "border-t border-border-light" : ""
            }`}
          >
            <span className="shrink-0 text-[12px] text-[var(--text-muted)]">{s.date_start}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-terra">
              {s.title}
            </span>
            {s.amount != null && (
              <span className="shrink-0 text-[12px] font-medium text-honey">{won(s.amount)}</span>
            )}
            <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
              {targetLabel(s.target_members, membersById)}
            </span>
          </button>
        ))}
      </div>

      <AddEventSheet
        open={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        workspaceId={workspaceId}
        members={Object.entries(membersById).map(([id, m]) => ({ id, display_name: m.display_name }))}
        defaultDate={editingSchedule?.date_start ?? anchorDate}
        existingSchedule={editingSchedule}
      />
    </div>
  );
}
