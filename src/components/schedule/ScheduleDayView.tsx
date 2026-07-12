"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RoutineWheel } from "@/components/schedule/RoutineWheel";
import { Chip } from "@/components/schedule/Chip";
import { CheckToggle } from "@/components/ui/CheckToggle";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { upsertRoutine, updateRoutineEnabled } from "@/app/(main)/schedule/actions";
import { STATUS_OPTIONS, STATUS_EMOJI, getCurrentBlock } from "@/lib/routineUtils";
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

// "기본 하루로 시작하기" — managed 멤버(자녀 등)가 루틴을 하나도 안 만들었을 때 골격만
// 깔아주는 템플릿. 마지막 "잠" 블록은 21:00~07:30로 자정을 넘겨 다음 블록("일어나서 준비")
// 시작 시각과 맞물리게 해서 하루 24시간이 비는 곳 없이 이어지도록 했다.
const DEFAULT_TEMPLATE: RoutineBlock[] = [
  { start: "07:30", end: "09:00", status: "커스텀", label: "일어나서 준비" },
  { start: "09:00", end: "16:00", status: "수업", label: "유치원" },
  { start: "16:00", end: "18:00", status: "휴식", label: "간식·놀이" },
  { start: "18:00", end: "19:00", status: "휴식", label: "저녁" },
  { start: "19:00", end: "20:00", status: "커스텀", label: "목욕" },
  { start: "20:00", end: "21:00", status: "커스텀", label: "책 읽고 잘 준비" },
  { start: "21:00", end: "07:30", status: "취침", label: "잠" },
];

const SWIPE_THRESHOLD = 40;
type Status = (typeof STATUS_OPTIONS)[number];

interface BlockForm {
  label: string;
  start: string;
  end: string;
  status: Status;
}

function sortBlocks(blocks: RoutineBlock[]) {
  return [...blocks].sort((a, b) => (a.start < b.start ? -1 : 1));
}

function toStatus(raw: string): Status {
  return (STATUS_OPTIONS as readonly string[]).includes(raw) ? (raw as Status) : "커스텀";
}

const EMPTY_FORM: BlockForm = { label: "", start: "09:00", end: "10:00", status: "업무" };

export function ScheduleDayView({
  members,
  initialRoutines,
  defaultMemberId,
}: {
  members: WorkspaceMemberInfo[];
  initialRoutines: Routine[];
  defaultMemberId: string;
}) {
  const { showToast } = useToast();

  // key: `${memberId}-${dayOfWeek}-${semester}`
  const [byKey, setByKey] = useState<Record<string, RoutineBlock[]>>(() => {
    const map: Record<string, RoutineBlock[]> = {};
    for (const r of initialRoutines) {
      map[`${r.member_id}-${r.day_of_week}-${r.semester}`] = r.blocks;
    }
    return map;
  });

  const [activeMemberId, setActiveMemberId] = useState(defaultMemberId || members[0]?.id || "");
  const [routineEnabledByMember, setRoutineEnabledByMember] = useState<Record<string, boolean>>(
    () => Object.fromEntries(members.map((m) => [m.id, m.routine_enabled]))
  );
  const routineEnabled = routineEnabledByMember[activeMemberId] ?? true;

  // 요일 칩은 하나만 선택된다 — 추가/수정/삭제 모두 지금 선택된 요일 하나에만 적용.
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDay());

  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BlockForm | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [addForm, setAddForm] = useState<BlockForm>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date());

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const activeMember = members.find((m) => m.id === activeMemberId);
  const key = `${activeMemberId}-${selectedDay}-${SEMESTER}`;
  const blocks = useMemo(() => sortBlocks(byKey[key] ?? []), [byKey, key]);

  const currentBlock = getCurrentBlock(blocks, now);
  const activeIndex = currentBlock ? blocks.indexOf(currentBlock) : -1;

  // managed 멤버가 어느 요일에도 블록을 하나도 안 만들었을 때만 템플릿 버튼을 보여준다.
  const memberHasNoRoutine = useMemo(
    () => DAYS.every((d) => (byKey[`${activeMemberId}-${d.value}-${SEMESTER}`] ?? []).length === 0),
    [byKey, activeMemberId]
  );
  const showTemplateButton = activeMember?.member_type === "managed" && memberHasNoRoutine;

  const cancelEdit = () => {
    setPickedIndex(null);
    setEditForm(null);
  };

  const switchMember = (memberId: string) => {
    setActiveMemberId(memberId);
    setSelectedDay(new Date().getDay());
    cancelEdit();
    setAddingOpen(false);
  };

  const selectDay = (value: number) => {
    cancelEdit();
    setSelectedDay(value);
  };

  const navigateDay = (direction: 1 | -1) => {
    cancelEdit();
    const currentIndex = DAYS.findIndex((d) => d.value === selectedDay);
    const nextIndex = (currentIndex + direction + DAYS.length) % DAYS.length;
    setSelectedDay(DAYS[nextIndex].value);
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

  const toggleRoutineEnabled = () => {
    const next = !routineEnabled;
    setRoutineEnabledByMember((prev) => ({ ...prev, [activeMemberId]: next }));
    startTransition(() => updateRoutineEnabled(activeMemberId, next));
  };

  /** 지금 선택된 요일 하나에만 updater를 적용해 로컬 상태를 즉시 반영하고, 같은 결과를
   * 그대로 서버에 저장한다(별도의 "저장하기" 버튼 없이 추가/수정/삭제가 그 자리에서 바로
   * 반영·저장되는 방식). */
  const applyToDay = (day: number, updater: (prevBlocksForDay: RoutineBlock[]) => RoutineBlock[]) => {
    const dayKey = `${activeMemberId}-${day}-${SEMESTER}`;
    const nextBlocks = updater(byKey[dayKey] ?? []);

    setByKey((prev) => ({ ...prev, [dayKey]: nextBlocks }));

    startTransition(async () => {
      try {
        await upsertRoutine(activeMemberId, day, SEMESTER, nextBlocks);
      } catch {
        showToast("저장에 실패했어요.");
      }
    });
  };

  const startEdit = (idx: number) => {
    const b = blocks[idx];
    setPickedIndex(idx);
    setEditForm({ label: b.label, start: b.start, end: b.end, status: toStatus(b.status) });
    setAddingOpen(false);
  };

  const saveEdit = () => {
    if (!editForm || pickedIndex === null) return;
    const label = editForm.label.trim();
    if (!label || editForm.start >= editForm.end) return;
    const updated: RoutineBlock = { start: editForm.start, end: editForm.end, status: editForm.status, label };

    applyToDay(selectedDay, (prev) => prev.map((b, i) => (i === pickedIndex ? updated : b)));
    cancelEdit();
  };

  const deleteBlock = () => {
    if (pickedIndex === null) return;
    applyToDay(selectedDay, (prev) => prev.filter((_, i) => i !== pickedIndex));
    cancelEdit();
  };

  const handleAddBlock = () => {
    const label = addForm.label.trim();
    if (!label || addForm.start >= addForm.end) return;
    const newBlock: RoutineBlock = { start: addForm.start, end: addForm.end, status: addForm.status, label };
    applyToDay(selectedDay, (prev) => [...prev, newBlock]);
    setAddForm(EMPTY_FORM);
    setAddingOpen(false);
  };

  const applyTemplate = () => {
    const updates = DAYS.map((d) => ({
      day: d.value,
      dayKey: `${activeMemberId}-${d.value}-${SEMESTER}`,
      blocks: DEFAULT_TEMPLATE,
    }));
    setByKey((prev) => {
      const next = { ...prev };
      for (const u of updates) next[u.dayKey] = u.blocks;
      return next;
    });
    startTransition(async () => {
      try {
        for (const u of updates) await upsertRoutine(activeMemberId, u.day, SEMESTER, u.blocks);
        showToast("기본 하루 일과를 적용했어요. 이름과 시간을 자유롭게 조정해보세요.");
      } catch {
        showToast("저장에 실패했어요.");
      }
    });
  };

  const StatusPicker = ({ value, onChange }: { value: Status; onChange: (s: Status) => void }) => (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_OPTIONS.map((s) => {
        const colorVar = STATUS_COLOR_VAR[s] ?? DEFAULT_STATUS_COLOR_VAR;
        const active = value === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              active ? "text-ink" : "bg-cream text-stone"
            }`}
            style={active ? { backgroundColor: `var(${colorVar})` } : undefined}
          >
            {STATUS_EMOJI[s]} {s}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {members.length > 1 && (
        <div className="flex flex-wrap items-center gap-4">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMember(m.id)}
              className={`text-[13px] ${
                activeMemberId === m.id ? "font-medium text-ink" : "text-[var(--text-muted)]"
              }`}
            >
              {m.display_name}
            </button>
          ))}
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-[11px] text-stone">
            루틴 사용
            <CheckToggle checked={routineEnabled} onChange={toggleRoutineEnabled} size={20} />
          </label>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto">
        {DAYS.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            active={d.value === selectedDay}
            onClick={() => selectDay(d.value)}
            className="w-8 px-0"
          />
        ))}
      </div>

      {!routineEnabled ? (
        <p className="py-14 text-center text-[13px] text-[var(--text-muted)]">
          {activeMember?.display_name ?? "이 멤버"}의 루틴을 사용하지 않는 중이에요
        </p>
      ) : (
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="flex flex-col gap-3">
          <RoutineWheel
            blocks={blocks}
            highlightedIndex={pickedIndex}
            onSelectBlock={(idx) => (idx === null ? cancelEdit() : startEdit(idx))}
          />
          <p className="text-center text-[12px] text-[var(--text-muted)]">
            블록을 누르면 바로 수정할 수 있어요
          </p>

          <div className="flex flex-col">
            {blocks.length === 0 && !showTemplateButton && (
              <p className="py-2 text-[13px] text-stone">등록된 시간 블록이 없어요</p>
            )}

            {showTemplateButton && (
              <button
                onClick={applyTemplate}
                disabled={isPending}
                className="mb-2 flex h-11 items-center justify-center rounded-xl border border-honey text-[13px] font-medium text-honey"
              >
                기본 하루로 시작하기
              </button>
            )}

            {blocks.map((b, idx) => {
              const colorVar = STATUS_COLOR_VAR[b.status] ?? DEFAULT_STATUS_COLOR_VAR;
              const isPicked = pickedIndex === idx;
              const isActive = activeIndex === idx;
              return (
                <div
                  key={idx}
                  className={`flex flex-col gap-2 py-2.5 ${idx > 0 ? "border-t border-border-light" : ""}`}
                >
                  <div
                    onClick={() => (isPicked ? cancelEdit() : startEdit(idx))}
                    className="flex cursor-pointer items-center gap-3"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: isPicked ? "var(--accent-sage)" : `var(${colorVar})`,
                        opacity: isActive || isPicked ? 1 : 0.55,
                      }}
                    />
                    <span className={`min-w-0 flex-1 truncate text-[14px] ${isPicked ? "text-sage" : "text-ink"}`}>
                      {b.label}
                    </span>
                    {!isPicked && (
                      <span className="shrink-0 text-[12px] text-stone">
                        {b.start}~{b.end}
                      </span>
                    )}
                  </div>

                  {isPicked && editForm && (
                    <div className="flex flex-col gap-2 pl-[18px]">
                      <Input
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        placeholder="이름"
                        className="h-10 rounded-xl px-3 text-[13px]"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={editForm.start}
                          onChange={(e) => setEditForm({ ...editForm, start: e.target.value })}
                          className="h-10 flex-1 rounded-xl px-3 text-[13px]"
                        />
                        <Input
                          type="time"
                          value={editForm.end}
                          onChange={(e) => setEditForm({ ...editForm, end: e.target.value })}
                          className="h-10 flex-1 rounded-xl px-3 text-[13px]"
                        />
                      </div>
                      <StatusPicker value={editForm.status} onChange={(s) => setEditForm({ ...editForm, status: s })} />
                      <div className="flex gap-2">
                        <button
                          onClick={deleteBlock}
                          className="flex-1 rounded-xl bg-cream py-2 text-[12px] font-medium text-terra"
                        >
                          삭제
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={!editForm.label.trim() || editForm.start >= editForm.end}
                          className="flex-1 rounded-xl bg-ink py-2 text-[12px] font-medium text-cream disabled:opacity-50"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {!addingOpen ? (
              <button
                onClick={() => {
                  cancelEdit();
                  setAddingOpen(true);
                }}
                className="py-3 text-left text-[13px] font-medium text-honey"
              >
                + 블록 추가
              </button>
            ) : (
              <div className="flex flex-col gap-2 border-t border-border-light pt-3">
                <Input
                  value={addForm.label}
                  onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                  placeholder="이름 (예: 요가, 유치원)"
                  className="h-10 rounded-xl px-3 text-[13px]"
                />
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={addForm.start}
                    onChange={(e) => setAddForm({ ...addForm, start: e.target.value })}
                    className="h-10 flex-1 rounded-xl px-3 text-[13px]"
                  />
                  <Input
                    type="time"
                    value={addForm.end}
                    onChange={(e) => setAddForm({ ...addForm, end: e.target.value })}
                    className="h-10 flex-1 rounded-xl px-3 text-[13px]"
                  />
                </div>
                <StatusPicker value={addForm.status} onChange={(s) => setAddForm({ ...addForm, status: s })} />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddingOpen(false)}
                    className="flex-1 rounded-xl bg-cream py-2 text-[12px] font-medium text-stone"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddBlock}
                    disabled={!addForm.label.trim() || addForm.start >= addForm.end}
                    className="flex-1 rounded-xl bg-ink py-2 text-[12px] font-medium text-cream disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
