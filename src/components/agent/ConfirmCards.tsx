"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconPencil, IconCheck, IconTrash } from "@tabler/icons-react";
import { createSchedule } from "@/app/(main)/schedule/actions";
import { upsertRoutine, getRoutineBlocks } from "@/app/(main)/schedule/actions";
import { Input } from "@/components/ui/Input";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import { STATUS_OPTIONS, STATUS_EMOJI } from "@/lib/routineUtils";
import { STATUS_COLOR_VAR, DEFAULT_STATUS_COLOR_VAR } from "@/lib/routineColors";
import { mirror } from "@/lib/homeTheme";
import { useToast } from "@/components/ui/Toast";
import type {
  AgentSchedule,
  AgentMemberOption,
  AgentRoutine,
  AgentRoutineBlock,
} from "@/lib/agentApi";
import type { RoutineBlock } from "@/types";

type CardStatus = "pending" | "registered" | "skipped";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface ScheduleCardState {
  kind: "schedule";
  schedule: AgentSchedule;
  status: CardStatus;
  title: string;
  targets: string[];
  isShared: boolean;
}

interface RoutineCardState {
  kind: "routine";
  days: number[];
  blocks: AgentRoutineBlock[];
  targetMemberId: string;
  status: CardStatus;
  existingByDay: Record<number, RoutineBlock[]>;
  overwriteOnOverlap: boolean;
  registeredDayCount: number | null;
}

type CardState = ScheduleCardState | RoutineCardState;

/** target_hint를 멤버 표시 이름과 대조해 대상을 미리 선택해 준다. 최종 선택은 사용자가 카드에서 직접 조정한다. */
function matchTargets(
  targetHint: string | null,
  members: AgentMemberOption[]
): { targets: string[]; isShared: boolean } {
  const hint = (targetHint || "").trim();
  if (!hint || hint.includes("가족") || hint.includes("전체")) {
    return { targets: [], isShared: true };
  }
  const matched = members.filter(
    (m) => hint.includes(m.display_name) || m.display_name.includes(hint)
  );
  if (matched.length === 0) return { targets: [], isShared: true };
  return { targets: matched.map((m) => m.id), isShared: false };
}

/** 루틴은 schedule.target_members와 달리 member_id 하나에만 귀속되므로 단일 대상을 고른다.
 * target_hint가 "본인"/"나"거나 아무도 못 맞추면 로그인한 본인 멤버로 기본 선택. */
function matchRoutineTarget(
  targetHint: string | null,
  members: AgentMemberOption[],
  currentMemberId: string
): string {
  const hint = (targetHint || "").trim();
  if (hint && !hint.includes("본인") && !hint.includes("나")) {
    const matched = members.find(
      (m) => hint.includes(m.display_name) || m.display_name.includes(hint)
    );
    if (matched) return matched.id;
  }
  return currentMemberId;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

/** 종료 ≤ 시작(자정을 넘기는 overnight 블록, 예: 21:00~07:30)은 [시작~24:00)과 [00:00~종료)
 * 두 구간으로 쪼갠 뒤 각 구간 쌍을 timesOverlap으로 비교 — 문자열 비교 기반인 timesOverlap은
 * "21:00" < "07:30" 같은 자정 넘김 케이스를 그대로 넣으면 항상 false가 되어 실제로 겹쳐도
 * 못 잡아내기 때문에, 겹침 판정 전에 정규화한다. */
function toSegments(start: string, end: string): { start: string; end: string }[] {
  if (end <= start) {
    return [
      { start, end: "24:00" },
      { start: "00:00", end },
    ];
  }
  return [{ start, end }];
}

function blocksOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const segmentsA = toSegments(aStart, aEnd);
  const segmentsB = toSegments(bStart, bEnd);
  return segmentsA.some((sa) => segmentsB.some((sb) => timesOverlap(sa.start, sa.end, sb.start, sb.end)));
}

function findOverlapWarnings(
  days: number[],
  blocks: AgentRoutineBlock[],
  existingByDay: Record<number, RoutineBlock[]>
): string[] {
  const warnings = new Set<string>();
  for (const day of days) {
    const existing = existingByDay[day] ?? [];
    for (const block of blocks) {
      if (!block.start || !block.end) continue;
      for (const ex of existing) {
        if (blocksOverlap(block.start, block.end, ex.start, ex.end)) {
          warnings.add(`${DAY_LABELS[day]}요일 기존 ${ex.start}~${ex.end} ${ex.label}와 겹침`);
        }
      }
    }
  }
  return Array.from(warnings);
}

export function ConfirmCards({
  workspaceId,
  members,
  currentMemberId,
  schedules,
  routines,
  routineTargetHint,
  onAllProcessed,
}: {
  workspaceId: string;
  members: AgentMemberOption[];
  currentMemberId: string;
  schedules: AgentSchedule[];
  routines: AgentRoutine[];
  routineTargetHint: string | null;
  onAllProcessed: (summary: { registered: number; skipped: number }) => void;
}) {
  const { showToast } = useToast();
  const [cards, setCards] = useState<CardState[]>(() => [
    ...schedules.map((s): ScheduleCardState => {
      const { targets, isShared } = matchTargets(s.target_hint, members);
      return { kind: "schedule", schedule: s, status: "pending", title: s.title, targets, isShared };
    }),
    ...routines.map((r): RoutineCardState => ({
      kind: "routine",
      days: r.days,
      blocks: r.blocks,
      targetMemberId: matchRoutineTarget(routineTargetHint, members, currentMemberId),
      status: "pending",
      existingByDay: {},
      overwriteOnOverlap: false,
      registeredDayCount: null,
    })),
  ]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<{ cardIndex: number; blockIndex: number } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const doneNotified = useRef(false);

  const total = cards.length;

  useEffect(() => {
    cards.forEach((c, i) => {
      if (c.kind === "routine") refreshExisting(i, c.targetMemberId, c.days);
    });
    // 최초 마운트 시 한 번만 기존 블록을 불러온다 (이후엔 요일/대상 변경 시 개별적으로 갱신)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshExisting = (index: number, memberId: string, days: number[]) => {
    if (!memberId || days.length === 0) return;
    getRoutineBlocks(memberId, days)
      .then((result) => {
        setCards((prev) =>
          prev.map((c, i) => (i === index && c.kind === "routine" ? { ...c, existingByDay: result } : c))
        );
      })
      .catch(() => {});
  };

  const notifyIfDone = (nextCards: CardState[]) => {
    if (doneNotified.current) return;
    if (nextCards.every((c) => c.status !== "pending")) {
      doneNotified.current = true;
      onAllProcessed({
        registered: nextCards.filter((c) => c.status === "registered").length,
        skipped: nextCards.filter((c) => c.status === "skipped").length,
      });
    }
  };

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  const goToNextPending = (fromIndex: number, nextCards: CardState[]) => {
    const after = nextCards.findIndex((c, i) => i > fromIndex && c.status === "pending");
    const target = after !== -1 ? after : nextCards.findIndex((c) => c.status === "pending");
    if (target !== -1) {
      setActiveIndex(target);
      scrollToIndex(target);
    }
  };

  const updateCard = (index: number, patch: Partial<ScheduleCardState>) => {
    setCards((prev) =>
      prev.map((c, i) => (i === index && c.kind === "schedule" ? { ...c, ...patch } : c))
    );
  };

  const handleSkip = (index: number) => {
    setCards((prev) => {
      const next = prev.map((c, i) => (i === index ? { ...c, status: "skipped" as CardStatus } : c));
      notifyIfDone(next);
      goToNextPending(index, next);
      return next;
    });
  };

  const handleRegisterSchedule = async (index: number) => {
    const card = cards[index];
    if (card.kind !== "schedule") return;
    const s = card.schedule;
    const composedMemo =
      [s.supplies ? `준비물: ${s.supplies}` : null, s.memo].filter(Boolean).join("\n") || null;

    const result = await createSchedule(workspaceId, {
      title: card.title.trim() || "새 일정",
      date_start: s.date_start || new Date().toISOString().slice(0, 10),
      date_end: s.date_end,
      time_start: s.time_start,
      time_end: s.time_end,
      target_members: card.targets,
      is_shared: card.isShared,
      keyword_main: s.keyword_main,
      keyword_sub: s.keyword_sub,
      is_important: s.is_important,
      memo: composedMemo,
      is_all_day: !s.time_start,
    });

    if (!result.ok) {
      showToast("등록에 실패했어요");
      return;
    }

    setCards((prev) => {
      const next = prev.map((c, i) => (i === index ? { ...c, status: "registered" as CardStatus } : c));
      notifyIfDone(next);
      goToNextPending(index, next);
      return next;
    });
  };

  const toggleTarget = (index: number, memberId: string) => {
    const card = cards[index];
    if (card.kind !== "schedule") return;
    const nextTargets = card.targets.includes(memberId)
      ? card.targets.filter((id) => id !== memberId)
      : [...card.targets, memberId];
    updateCard(index, { targets: nextTargets, isShared: nextTargets.length === 0 });
  };

  const toggleRoutineDay = (index: number, day: number) => {
    const card = cards[index];
    if (card.kind !== "routine") return;
    const has = card.days.includes(day);
    if (has && card.days.length === 1) return; // 최소 1개 요일은 유지
    const nextDays = has ? card.days.filter((d) => d !== day) : [...card.days, day].sort((a, b) => a - b);
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, days: nextDays } : c)));
    refreshExisting(index, card.targetMemberId, nextDays);
  };

  const setRoutineTarget = (index: number, memberId: string) => {
    const card = cards[index];
    if (card.kind !== "routine") return;
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, targetMemberId: memberId } : c)));
    refreshExisting(index, memberId, card.days);
  };

  const updateRoutineBlock = (index: number, blockIndex: number, patch: Partial<AgentRoutineBlock>) => {
    setCards((prev) =>
      prev.map((c, i) => {
        if (i !== index || c.kind !== "routine") return c;
        return { ...c, blocks: c.blocks.map((b, bi) => (bi === blockIndex ? { ...b, ...patch } : b)) };
      })
    );
  };

  const deleteRoutineBlock = (index: number, blockIndex: number) => {
    setCards((prev) =>
      prev.map((c, i) => {
        if (i !== index || c.kind !== "routine") return c;
        return { ...c, blocks: c.blocks.filter((_, bi) => bi !== blockIndex) };
      })
    );
    if (editingBlock?.cardIndex === index && editingBlock.blockIndex === blockIndex) {
      setEditingBlock(null);
    }
  };

  const toggleOverwrite = (index: number, value: boolean) => {
    setCards((prev) =>
      prev.map((c, i) => (i === index && c.kind === "routine" ? { ...c, overwriteOnOverlap: value } : c))
    );
  };

  const handleRegisterRoutine = async (index: number) => {
    const card = cards[index];
    if (card.kind !== "routine") return;
    if (!card.targetMemberId || card.days.length === 0 || card.blocks.length === 0) {
      showToast("대상과 요일, 블록을 확인해주세요");
      return;
    }

    try {
      for (const day of card.days) {
        const existing = card.existingByDay[day] ?? [];
        const kept = card.overwriteOnOverlap
          ? existing.filter(
              (ex) =>
                !card.blocks.some(
                  (b) => b.start && b.end && timesOverlap(b.start, b.end, ex.start, ex.end)
                )
            )
          : existing;
        const merged = [
          ...kept,
          ...card.blocks.map((b) => ({
            start: b.start as string,
            end: b.end as string,
            status: b.status,
            label: b.label,
            memo: b.memo ?? undefined,
          })),
        ];
        await upsertRoutine(card.targetMemberId, day, "default", merged);
      }
    } catch {
      showToast("등록에 실패했어요");
      return;
    }

    setCards((prev) => {
      const next = prev.map((c, i) =>
        i === index
          ? { ...c, status: "registered" as CardStatus, registeredDayCount: card.days.length }
          : c
      );
      notifyIfDone(next);
      goToNextPending(index, next);
      return next;
    });
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-[13px] text-stone">
        {Math.min(activeIndex + 1, total)}/{total} 확인 중
      </span>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const width = e.currentTarget.clientWidth || 1;
          setActiveIndex(Math.round(e.currentTarget.scrollLeft / width));
        }}
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto"
      >
        {cards.map((card, index) => {
          const isDone = card.status !== "pending";

          if (card.kind === "schedule") {
            const group = KEYWORD_GROUPS.find((g) => g.main === card.schedule.keyword_main);
            return (
              <div
                key={index}
                className={`flex w-full shrink-0 snap-center flex-col gap-2.5 rounded-2xl border border-border-light p-4 transition-opacity ${
                  isDone ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  {group ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[13px] font-medium"
                      style={{ color: group.color, backgroundColor: `${group.color}1A` }}
                    >
                      {group.main}
                    </span>
                  ) : (
                    <span />
                  )}
                  {isDone && (
                    <span className="text-[13px] font-medium text-sage">
                      {card.status === "registered" ? "등록됨" : "건너뜀"}
                    </span>
                  )}
                </div>

                {editingIndex === index ? (
                  <Input
                    autoFocus
                    value={card.title}
                    onChange={(e) => updateCard(index, { title: e.target.value })}
                    onBlur={() => setEditingIndex(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingIndex(null)}
                    className="rounded-lg px-2 py-1 text-[18px] font-medium"
                  />
                ) : (
                  <button
                    onClick={() => !isDone && setEditingIndex(index)}
                    disabled={isDone}
                    className="flex items-center gap-1.5 text-left text-[18px] font-medium text-ink"
                  >
                    {card.title}
                    {!isDone && <IconPencil size={13} className="text-stone" />}
                  </button>
                )}

                <div className="flex flex-col gap-1 text-[14px] text-stone">
                  <span>
                    {card.schedule.date_start ?? "날짜 미정"}
                    {card.schedule.date_end ? ` ~ ${card.schedule.date_end}` : ""}
                    {card.schedule.time_start ? ` · ${card.schedule.time_start}` : ""}
                    {card.schedule.time_end ? `~${card.schedule.time_end}` : ""}
                  </span>
                  {card.schedule.supplies && <span>준비물: {card.schedule.supplies}</span>}
                  {card.schedule.memo && <span>{card.schedule.memo}</span>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => updateCard(index, { targets: [], isShared: true })}
                    disabled={isDone}
                    className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${
                      card.isShared ? "bg-ink text-cream" : "bg-cream text-stone"
                    }`}
                  >
                    가족 전체
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleTarget(index, m.id)}
                      disabled={isDone}
                      className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${
                        card.targets.includes(m.id) ? "bg-ink text-cream" : "bg-cream text-stone"
                      }`}
                    >
                      {m.display_name}
                    </button>
                  ))}
                </div>

                {!isDone && (
                  <div className="mt-1 flex gap-2">
                    <button
                      onClick={() => handleSkip(index)}
                      className="flex-1 rounded-xl bg-cream py-2 text-[16px] font-medium text-stone"
                    >
                      건너뛰기
                    </button>
                    <button
                      onClick={() => handleRegisterSchedule(index)}
                      className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-honey py-2 text-[16px] font-medium text-white"
                    >
                      <IconCheck size={15} /> 등록
                    </button>
                  </div>
                )}
              </div>
            );
          }

          // 루틴 카드
          const overlapWarnings = findOverlapWarnings(card.days, card.blocks, card.existingByDay);
          const registerDisabled =
            !card.targetMemberId ||
            card.days.length === 0 ||
            card.blocks.length === 0 ||
            card.blocks.some((b) => !b.start || !b.end);

          return (
            <div
              key={index}
              className={`flex w-full shrink-0 snap-center flex-col gap-2.5 rounded-2xl border border-border-light p-4 transition-opacity ${
                isDone ? "opacity-40" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-lavender/15 px-2.5 py-1 text-[13px] font-medium text-lavender">
                  루틴
                </span>
                {card.status === "registered" ? (
                  <span className="text-[13px] font-medium text-sage">
                    루틴 {card.registeredDayCount}개 요일에 적용했어요
                  </span>
                ) : (
                  card.status === "skipped" && (
                    <span className="text-[13px] font-medium text-sage">건너뜀</span>
                  )
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={mirror.label}>적용 요일</span>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      onClick={() => toggleRoutineDay(index, day)}
                      disabled={isDone}
                      className={`h-7 w-7 shrink-0 rounded-full text-[13px] font-medium ${
                        card.days.includes(day) ? "bg-ink text-cream" : "bg-cream text-stone"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className={mirror.label}>대상</span>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setRoutineTarget(index, m.id)}
                      disabled={isDone}
                      className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${
                        card.targetMemberId === m.id ? "bg-ink text-cream" : "bg-cream text-stone"
                      }`}
                    >
                      {m.display_name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                {card.blocks.map((b, bi) => {
                  const colorVar = STATUS_COLOR_VAR[b.status] ?? DEFAULT_STATUS_COLOR_VAR;
                  const isEditingThis =
                    editingBlock?.cardIndex === index && editingBlock.blockIndex === bi;

                  if (isEditingThis) {
                    return (
                      <div key={bi} className="flex flex-col gap-1.5 rounded-xl bg-cream p-2.5">
                        <div className="flex gap-1.5">
                          <Input
                            type="time"
                            value={b.start ?? ""}
                            onChange={(e) => updateRoutineBlock(index, bi, { start: e.target.value })}
                            className="h-9 flex-1 rounded-lg px-2 text-[14px]"
                          />
                          <Input
                            type="time"
                            value={b.end ?? ""}
                            onChange={(e) => updateRoutineBlock(index, bi, { end: e.target.value })}
                            className="h-9 flex-1 rounded-lg px-2 text-[14px]"
                          />
                        </div>
                        <Input
                          value={b.label}
                          onChange={(e) => updateRoutineBlock(index, bi, { label: e.target.value })}
                          placeholder="활동 이름"
                          className="h-9 rounded-lg px-2 text-[14px]"
                        />
                        <div className="flex flex-wrap gap-1">
                          {STATUS_OPTIONS.map((s) => {
                            const optionColorVar = STATUS_COLOR_VAR[s] ?? DEFAULT_STATUS_COLOR_VAR;
                            const active = b.status === s;
                            return (
                              <button
                                key={s}
                                onClick={() => updateRoutineBlock(index, bi, { status: s })}
                                className={`rounded-full px-2 py-1 text-[12px] font-medium ${
                                  active ? "text-ink" : "bg-cream text-stone"
                                }`}
                                style={active ? { backgroundColor: `var(${optionColorVar})` } : undefined}
                              >
                                {STATUS_EMOJI[s]} {s}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setEditingBlock(null)}
                          className="self-end text-[13px] font-medium text-honey"
                        >
                          완료
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={bi}
                      className={`flex items-center gap-2 py-1 ${bi > 0 ? "border-t border-border-light" : ""}`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(${colorVar})` }}
                      />
                      <span className="w-24 shrink-0 text-[13px] text-stone">
                        {b.start && b.end ? `${b.start}~${b.end}` : "시간 미정"}
                      </span>
                      <span className="shrink-0 text-[17px]">{STATUS_EMOJI[b.status] ?? "✨"}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{b.label}</span>
                      {!isDone && (
                        <>
                          <button
                            onClick={() => setEditingBlock({ cardIndex: index, blockIndex: bi })}
                            aria-label="블록 수정"
                          >
                            <IconPencil size={13} className="text-stone" />
                          </button>
                          <button
                            onClick={() => deleteRoutineBlock(index, bi)}
                            aria-label="블록 삭제"
                          >
                            <IconTrash size={13} className="text-stone" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {card.blocks.length === 0 && (
                  <p className="text-[14px] text-stone">삭제된 블록이 없어요</p>
                )}
              </div>

              {overlapWarnings.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl bg-terra/10 p-2.5">
                  {overlapWarnings.map((w) => (
                    <span key={w} className="text-[13px] text-terra">
                      {w}
                    </span>
                  ))}
                  <label className="flex items-center gap-1.5 text-[13px] text-stone">
                    <input
                      type="checkbox"
                      checked={card.overwriteOnOverlap}
                      onChange={(e) => toggleOverwrite(index, e.target.checked)}
                    />
                    겹치는 기존 블록 덮어쓰기
                  </label>
                </div>
              )}

              {card.status === "registered" && (
                <Link
                  href="/schedule?view=day"
                  className="self-start text-[13px] font-medium text-honey underline underline-offset-2"
                >
                  하루 화면에서 보기
                </Link>
              )}

              {!isDone && (
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => handleSkip(index)}
                    className="flex-1 rounded-xl bg-cream py-2 text-[16px] font-medium text-stone"
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={() => handleRegisterRoutine(index)}
                    disabled={registerDisabled}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-honey py-2 text-[16px] font-medium text-white disabled:opacity-50"
                  >
                    <IconCheck size={15} /> 등록
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <div className="flex justify-center gap-1.5">
          {cards.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i === activeIndex ? "bg-honey" : "bg-border-light"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
