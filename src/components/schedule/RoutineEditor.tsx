"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { upsertRoutine } from "@/app/(main)/schedule/actions";
import { Input } from "@/components/ui/Input";
import { STATUS_OPTIONS, STATUS_EMOJI } from "@/lib/routineUtils";
import type { Routine, RoutineBlock } from "@/types";

const DAYS = [
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
  { value: 0, label: "일" },
];

const SEMESTERS = [
  { value: "default", label: "기본" },
  { value: "summer", label: "여름학기" },
  { value: "winter", label: "겨울학기" },
];

function sortBlocks(blocks: RoutineBlock[]) {
  return [...blocks].sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function RoutineEditor({ initialRoutines }: { initialRoutines: Routine[] }) {
  const [semester, setSemester] = useState("default");
  const [day, setDay] = useState(1);
  const [byKey, setByKey] = useState<Record<string, RoutineBlock[]>>(() => {
    const map: Record<string, RoutineBlock[]> = {};
    for (const r of initialRoutines) {
      map[`${r.day_of_week}-${r.semester}`] = r.blocks;
    }
    return map;
  });
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();
  const [savedMessage, setSavedMessage] = useState("");

  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("업무");
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");

  const key = `${day}-${semester}`;
  const blocks = useMemo(() => sortBlocks(byKey[key] ?? []), [byKey, key]);

  const setBlocksFor = (targetKey: string, next: RoutineBlock[]) => {
    setByKey((prev) => ({ ...prev, [targetKey]: next }));
  };

  const addBlock = () => {
    if (!label.trim() || start >= end) return;
    const block: RoutineBlock = { start, end, status, label: label.trim(), memo: memo || undefined };
    setBlocksFor(key, [...(byKey[key] ?? []), block]);
    setLabel("");
    setMemo("");
  };

  const removeBlock = (idx: number) => {
    const next = blocks.filter((_, i) => i !== idx);
    setBlocksFor(key, next);
  };

  const save = () => {
    startTransition(async () => {
      await upsertRoutine(day, semester, byKey[key] ?? []);
      setSavedMessage("저장되었습니다");
      setTimeout(() => setSavedMessage(""), 1500);
    });
  };

  const copyToOtherDays = () => {
    if (copyTargets.length === 0) return;
    startTransition(async () => {
      for (const targetDay of copyTargets) {
        const targetKey = `${targetDay}-${semester}`;
        setBlocksFor(targetKey, byKey[key] ?? []);
        await upsertRoutine(targetDay, semester, byKey[key] ?? []);
      }
      setSavedMessage("복사되었습니다");
      setTimeout(() => setSavedMessage(""), 1500);
      setCopyTargets([]);
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

      <div className="flex flex-col gap-4 px-4">
        <div className="flex gap-2">
          {SEMESTERS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSemester(s.value)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                semester === s.value ? "bg-ink text-cream" : "bg-surface text-stone"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {DAYS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDay(d.value)}
              className={`h-10 w-10 shrink-0 rounded-full text-[13px] font-medium ${
                day === d.value ? "bg-ink text-cream" : "bg-surface text-stone"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border-light bg-surface p-4">
          {blocks.length === 0 && (
            <p className="text-[13px] text-stone">등록된 시간 블록이 없어요</p>
          )}
          {blocks.map((b, idx) => (
            <div key={`${b.start}-${idx}`} className="flex items-center gap-2">
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
              <button onClick={() => removeBlock(idx)} aria-label="삭제">
                <IconTrash size={16} className="text-stone" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-surface p-4">
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
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${
                  status === s ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {STATUS_EMOJI[s]} {s}
              </button>
            ))}
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

        <div className="flex flex-col gap-2 rounded-2xl border border-border-light bg-surface p-4">
          <span className="text-[12px] font-medium text-stone">다른 요일에 복사</span>
          <div className="flex flex-wrap gap-2">
            {DAYS.filter((d) => d.value !== day).map((d) => (
              <button
                key={d.value}
                onClick={() =>
                  setCopyTargets((prev) =>
                    prev.includes(d.value)
                      ? prev.filter((v) => v !== d.value)
                      : [...prev, d.value]
                  )
                }
                className={`h-9 w-9 rounded-full text-[12px] font-medium ${
                  copyTargets.includes(d.value) ? "bg-ink text-cream" : "bg-cream text-stone"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={copyToOtherDays}
            disabled={copyTargets.length === 0 || isPending}
            className="mt-1 flex h-11 items-center justify-center rounded-xl bg-cream text-[13px] font-medium text-ink disabled:opacity-50"
          >
            선택한 요일에 복사
          </button>
        </div>

        <button
          onClick={save}
          disabled={isPending}
          className="flex h-12 items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream"
        >
          {savedMessage || "저장하기"}
        </button>
      </div>
    </div>
  );
}
