"use client";

import { useState } from "react";
import { IconPencil, IconPaperclip } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { deleteSchedule } from "@/app/(main)/schedule/actions";
import { getKeywordColor } from "@/lib/scheduleKeywords";
import { shortRange } from "@/lib/scheduleFormat";
import { targetLabel, type MemberInfo } from "@/lib/scheduleTargets";
import type { ExpandedSchedule } from "@/lib/recurrence";

function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function timeLabel(s: ExpandedSchedule) {
  if (s.is_all_day || !s.time_start) return "종일";
  const start = s.time_start.slice(0, 5);
  const end = s.time_end ? s.time_end.slice(0, 5) : null;
  return end ? `${start}–${end}` : start;
}

function recurLabel(s: ExpandedSchedule) {
  if (s.recur_type === "none") return null;
  const type = s.recur_type === "weekly" ? "매주" : s.recur_type === "monthly" ? "매월" : "매년";
  return s.recur_type === "yearly" && s.recur_calendar === "lunar" ? `${type}·음력` : type;
}

/** 일정을 클릭하면 먼저 뜨는 읽기 전용 상세 팝업 — 우측 상단 연필 아이콘으로 수정 시트
 * (AddEventSheet)로 전환하고, 삭제도 이 안에서 바로 가능하다(2026-07-12 클릭 동선 변경 —
 * 이전엔 클릭하면 바로 수정 시트가 열렸음). 반복 일정 가상 인스턴스는 그 날짜 기준으로
 * 표시하되, 삭제/수정은 원본(originalId)에 적용된다. */
export function ScheduleDetailSheet({
  schedule,
  membersById,
  onClose,
  onEdit,
}: {
  schedule: ExpandedSchedule | null;
  membersById: Record<string, MemberInfo>;
  onClose: () => void;
  onEdit: (schedule: ExpandedSchedule) => void;
}) {
  const { showToast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleDelete = async () => {
    if (!schedule) return;
    setIsPending(true);
    const result = await deleteSchedule(schedule.originalId ?? schedule.id);
    setIsPending(false);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    showToast("일정이 삭제되었습니다.");
    setDeleteConfirmOpen(false);
    onClose();
  };

  return (
    <BottomSheet
      open={!!schedule}
      onClose={() => {
        setDeleteConfirmOpen(false);
        onClose();
      }}
    >
      {schedule && (
        <div className="flex flex-col gap-3">
          {deleteConfirmOpen ? (
            <div className="flex flex-col gap-3">
              <p className="text-[16px] text-ink">정말 삭제하시겠어요?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 rounded-xl bg-cream py-2.5 text-[16px] font-medium text-stone"
                >
                  취소
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex flex-1 items-center justify-center rounded-xl bg-terra py-2.5 text-[16px] font-medium text-white disabled:opacity-50"
                >
                  삭제하기
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 text-[20px] font-medium text-ink">{schedule.title}</h2>
                <button
                  onClick={() => onEdit(schedule)}
                  aria-label="수정"
                  className="shrink-0 text-[var(--text-muted)]"
                >
                  <IconPencil size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-2 text-[16px]">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[var(--text-muted)]">날짜</span>
                  <span className="text-ink">{shortRange(schedule)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[var(--text-muted)]">시간</span>
                  <span className="text-ink">{timeLabel(schedule)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-[var(--text-muted)]">대상</span>
                  <span className="text-ink">{targetLabel(schedule.target_members, membersById)}</span>
                </div>
                {schedule.keyword_main && (
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[var(--text-muted)]">키워드</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[13px] font-medium"
                      style={{
                        color: getKeywordColor(schedule.keyword_main),
                        backgroundColor: `${getKeywordColor(schedule.keyword_main)}14`,
                      }}
                    >
                      {schedule.keyword_main}
                      {schedule.keyword_sub ? ` · ${schedule.keyword_sub}` : ""}
                    </span>
                  </div>
                )}
                {schedule.amount != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[var(--text-muted)]">금액</span>
                    <span className="font-medium text-honey">{won(schedule.amount)}</span>
                  </div>
                )}
                {recurLabel(schedule) && (
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-[var(--text-muted)]">반복</span>
                    <span className="text-ink">{recurLabel(schedule)}</span>
                  </div>
                )}
              </div>

              {schedule.memo && (
                <div className="flex flex-col gap-1 border-t border-border-light pt-3">
                  <span className="flex items-center gap-1 text-[14px] text-[var(--text-muted)]">
                    <IconPaperclip size={12} />
                    메모
                  </span>
                  <p className="whitespace-pre-wrap text-[16px] text-ink">{schedule.memo}</p>
                </div>
              )}

              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="self-start text-[16px] text-terra"
              >
                삭제하기
              </button>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
