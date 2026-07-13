"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import { AddEventSheet } from "@/components/schedule/AddEventSheet";
import { ScheduleDetailSheet } from "@/components/schedule/ScheduleDetailSheet";
import { SectionExpand } from "@/components/ui/SectionExpand";
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
  const [editingSchedule, setEditingSchedule] = useState<ExpandedSchedule | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<ExpandedSchedule | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);

  // schedule/page.tsx가 뷰 종류와 무관하게 keywordMain URL 파라미터로 schedules를
  // 걸러서 내려주므로, 여기서 고른 키워드는 월간 뷰로 전환해도 그대로 유지된다
  // (월간/주간은 키워드 필터 UI 자체가 없어졌지만 URL 파라미터 필터링 로직은 공유).
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
    .filter((s) => selectedMonth == null || new Date(s.date_start).getMonth() === selectedMonth)
    .sort((a, b) => (a.date_start < b.date_start ? -1 : 1));

  const totalAmount = importantSchedules.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  const toggleMonth = (m: number) => {
    setSelectedMonth((prev) => (prev === m ? null : m));
    setListOpen(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-y-4 text-center">
        {Array.from({ length: 12 }, (_, m) => {
          const count = countByMonth[m] ?? 0;
          const isSelected = selectedMonth === m;
          return (
            <button
              key={m}
              onClick={() => toggleMonth(m)}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center whitespace-nowrap rounded-full text-[11px] font-medium ${
                  isSelected ? "bg-honey/15 text-honey" : "text-ink"
                }`}
              >
                {m + 1}월
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {count > 0 ? `일정 ${count}건` : "-"}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`h-px w-full bg-border-light`} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-medium text-[var(--text-muted)]">
            {selectedMonth != null ? `${selectedMonth + 1}월 주요 일정` : "연간 주요 일정"}
          </span>
          <button
            onClick={() => setListOpen((v) => !v)}
            className="text-[11px] font-medium text-honey"
          >
            {listOpen ? "접기" : "펼치기"}
          </button>
        </div>

        {listOpen && (
          <>
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
            {importantSchedules.length > 0 && (
              <SectionExpand
                items={importantSchedules}
                pageSize={6}
                renderItem={(s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setDetailSchedule(s)}
                    className={`flex items-center gap-3 py-2.5 text-left ${
                      i > 0 ? "border-t border-border-light" : ""
                    }`}
                  >
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{s.date_start}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-terra">
                      {s.title}
                    </span>
                    {s.amount != null && (
                      <span className="shrink-0 text-[11px] font-medium text-honey">{won(s.amount)}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
                      {targetLabel(s.target_members, membersById)}
                    </span>
                  </button>
                )}
              />
            )}
          </>
        )}
      </div>

      <AddEventSheet
        open={!!editingSchedule}
        onClose={() => setEditingSchedule(null)}
        workspaceId={workspaceId}
        members={Object.entries(membersById).map(([id, m]) => ({ id, display_name: m.display_name }))}
        defaultDate={editingSchedule?.date_start ?? anchorDate}
        existingSchedule={editingSchedule}
      />

      <ScheduleDetailSheet
        schedule={detailSchedule}
        membersById={membersById}
        onClose={() => setDetailSchedule(null)}
        onEdit={(s) => {
          setDetailSchedule(null);
          setEditingSchedule(s);
        }}
      />
    </div>
  );
}
