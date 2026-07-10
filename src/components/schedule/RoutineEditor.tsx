"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { upsertRoutine } from "@/app/(main)/schedule/actions";
import { Input } from "@/components/ui/Input";
import { RoutineWheel } from "@/components/schedule/RoutineWheel";
import { STATUS_OPTIONS, STATUS_EMOJI } from "@/lib/routineUtils";
import { STATUS_COLOR_VAR, DEFAULT_STATUS_COLOR_VAR } from "@/lib/routineColors";
import type { Routine, RoutineBlock } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

// routine.semester 컬럼은 유지하되, UI에서는 학기 구분을 없애고 항상 'default'로 고정한다.
const SEMESTER = "default";

const DAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

const SWIPE_THRESHOLD = 40;

function sortBlocks(blocks: RoutineBlock[]) {
  return [...blocks].sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function RoutineEditor({
  initialRoutines,
  members,
  defaultMemberId,
}: {
  initialRoutines: Routine[];
  members: WorkspaceMemberInfo[];
  defaultMemberId: string;
}) {
  // key: `${memberId}-${dayOfWeek}-${semester}`
  const [byKey, setByKey] = useState<Record<string, RoutineBlock[]>>(() => {
    const map: Record<string, RoutineBlock[]> = {};
    for (const r of initialRoutines) {
      map[`${r.member_id}-${r.day_of_week}-${r.semester}`] = r.blocks;
    }
    return map;
  });

  // 누구의 루틴인지 — 기본은 나 자신, managed 멤버를 선택하면 그 멤버의 루틴을 편집
  const [activeMemberId, setActiveMemberId] = useState(defaultMemberId || members[0]?.id || "");

  // 요일 칩 다중 선택 — 배열 순서 = 선택한 순서, 마지막 항목이 차트/리스트에 보여줄 "기준 요일".
  const [selectedDays, setSelectedDays] = useState<number[]>(() => [new Date().getDay()]);
  const primaryDay = selectedDays[selectedDays.length - 1];

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savedMessage, setSavedMessage] = useState("");

  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("업무");
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");

  const key = `${activeMemberId}-${primaryDay}-${SEMESTER}`;
  const blocks = useMemo(() => sortBlocks(byKey[key] ?? []), [byKey, key]);

  const touchStartX = useRef<number | null>(null);

  const setBlocksFor = (targetKey: string, next: RoutineBlock[]) => {
    setByKey((prev) => ({ ...prev, [targetKey]: next }));
  };

  const switchMember = (memberId: string) => {
    setActiveMemberId(memberId);
    setSelectedDays([new Date().getDay()]);
    setHighlightedIndex(null);
  };

  const toggleDay = (value: number) => {
    setHighlightedIndex(null);
    setSelectedDays((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev; // 최소 1개는 항상 선택 상태 유지
        return prev.filter((d) => d !== value);
      }
      return [...prev, value];
    });
  };

  const navigateDay = (direction: 1 | -1) => {
    setHighlightedIndex(null);
    const currentIndex = DAYS.findIndex((d) => d.value === primaryDay);
    const nextIndex = (currentIndex + direction + DAYS.length) % DAYS.length;
    setSelectedDays([DAYS[nextIndex].value]);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    navigateDay(delta < 0 ? 1 : -1);
  };

  // 블록 추가 시 현재 선택된 모든 요일에 동시 적용 ("다른 요일에 복사"를 대체).
  const addBlock = () => {
    if (!label.trim() || start >= end) return;
    const block: RoutineBlock = { start, end, status, label: label.trim(), memo: memo || undefined };
    setByKey((prev) => {
      const next = { ...prev };
      for (const day of selectedDays) {
        const dayKey = `${activeMemberId}-${day}-${SEMESTER}`;
        next[dayKey] = [...(prev[dayKey] ?? []), block];
      }
      return next;
    });
    setLabel("");
    setMemo("");
  };

  const removeBlock = (idx: number) => {
    const next = blocks.filter((_, i) => i !== idx);
    setBlocksFor(key, next);
    setHighlightedIndex(null);
  };

  const save = () => {
    startTransition(async () => {
      for (const day of selectedDays) {
        const dayKey = `${activeMemberId}-${day}-${SEMESTER}`;
        await upsertRoutine(activeMemberId, day, SEMESTER, byKey[dayKey] ?? []);
      }
      setSavedMessage("저장되었습니다");
      setTimeout(() => setSavedMessage(""), 1500);
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream pb-10">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/schedule" aria-label="뒤로가기">
          <IconArrowLeft size={22} className="text-ink" />
        </Link>
        <h1 className="text-[15px] font-medium text-ink">내 루틴</h1>
        <div className="w-[22px]" />
      </header>

      <div
        className="flex flex-col gap-4 px-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {members.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-medium text-stone">누구의 루틴인가요</span>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => switchMember(m.id)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${
                    activeMemberId === m.id ? "bg-ink text-cream" : "bg-surface text-stone"
                  }`}
                >
                  {m.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <RoutineWheel
          blocks={blocks}
          highlightedIndex={highlightedIndex}
          onSelectBlock={setHighlightedIndex}
        />

        <div className="h-px w-full bg-border-light" />

        <div className="flex gap-1.5 overflow-x-auto">
          {DAYS.map((d) => {
            const isSelected = selectedDays.includes(d.value);
            const isPrimary = d.value === primaryDay;
            return (
              <button
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`h-10 w-10 shrink-0 rounded-full text-[13px] font-medium ${
                  isPrimary
                    ? "bg-ink text-cream"
                    : isSelected
                    ? "bg-honey/15 text-ink"
                    : "bg-surface text-stone"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        {selectedDays.length > 1 && (
          <p className="text-[11px] text-stone">
            선택한 {selectedDays.length}개 요일에 블록이 함께 추가/저장돼요. 좌우로 스와이프하면
            보기 요일이 바뀌어요.
          </p>
        )}

        <div className="h-px w-full bg-border-light" />

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium text-stone">
            {DAYS.find((d) => d.value === primaryDay)?.label}요일 시간 블록
          </span>
          {blocks.length === 0 && (
            <p className="text-[13px] text-stone">등록된 시간 블록이 없어요</p>
          )}
          {blocks.map((b, idx) => {
            const colorVar = STATUS_COLOR_VAR[b.status] ?? DEFAULT_STATUS_COLOR_VAR;
            return (
              <div
                key={`${b.start}-${idx}`}
                onClick={() => setHighlightedIndex(highlightedIndex === idx ? null : idx)}
                className={`flex cursor-pointer items-center gap-2 py-1.5 ${
                  idx > 0 ? "border-t border-border-light" : ""
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${colorVar})` }}
                />
                <span className="w-24 shrink-0 text-[12px] text-stone">
                  {b.start}~{b.end}
                </span>
                <span className="shrink-0 text-[16px]">{STATUS_EMOJI[b.status] ?? "✨"}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{b.label}</span>
                {b.memo && (
                  <span className="max-w-[30%] shrink-0 truncate text-[11px] text-stone">
                    {b.memo}
                  </span>
                )}
                <button
                  aria-label="삭제"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeBlock(idx);
                  }}
                >
                  <IconTrash size={16} className="text-stone" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="h-px w-full bg-border-light" />

        <div className="flex flex-col gap-3">
          <span className="text-[12px] font-medium text-stone">블록 추가</span>
          <div className="flex gap-2">
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-11 flex-1 rounded-xl px-3 text-[13px]"
            />
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-11 flex-1 rounded-xl px-3 text-[13px]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const colorVar = STATUS_COLOR_VAR[s] ?? DEFAULT_STATUS_COLOR_VAR;
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                    active ? "text-ink" : "bg-cream text-stone"
                  }`}
                  style={active ? { backgroundColor: `var(${colorVar})` } : undefined}
                >
                  {STATUS_EMOJI[s]} {s}
                </button>
              );
            })}
          </div>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="이름 (예: 요가, 유치원)"
            className="h-11 rounded-xl px-3 text-[13px]"
          />
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="메모 (예: 활동복)"
            className="h-11 rounded-xl px-3 text-[13px]"
          />
          <button
            onClick={addBlock}
            className="flex h-11 items-center justify-center rounded-xl bg-cream text-[13px] font-medium text-ink"
          >
            블록 추가하기
          </button>
        </div>

        <button
          onClick={save}
          disabled={isPending || !activeMemberId}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream disabled:opacity-50"
        >
          {savedMessage || "저장하기"}
        </button>
      </div>
    </div>
  );
}
