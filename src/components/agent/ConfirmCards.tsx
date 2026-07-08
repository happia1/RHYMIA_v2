"use client";

import { useRef, useState } from "react";
import { IconPencil, IconCheck } from "@tabler/icons-react";
import { createSchedule } from "@/app/(main)/schedule/actions";
import { Input } from "@/components/ui/Input";
import { KEYWORD_GROUPS } from "@/lib/scheduleKeywords";
import { useToast } from "@/components/ui/Toast";
import type { WorkspaceMemberInfo } from "@/lib/members";
import type { AgentSchedule } from "@/lib/agentApi";

type CardStatus = "pending" | "registered" | "skipped";

interface CardState {
  schedule: AgentSchedule;
  status: CardStatus;
  title: string;
  targets: string[];
  isShared: boolean;
}

/** target_hint를 멤버 표시 이름과 대조해 대상을 미리 선택해 준다. 최종 선택은 사용자가 카드에서 직접 조정한다. */
function matchTargets(
  targetHint: string | null,
  members: WorkspaceMemberInfo[]
): { targets: string[]; isShared: boolean } {
  const hint = (targetHint || "").trim();
  if (!hint || hint.includes("가족") || hint.includes("전체")) {
    return { targets: [], isShared: true };
  }
  const matched = members.filter(
    (m) => hint.includes(m.display_name) || m.display_name.includes(hint)
  );
  if (matched.length === 0) return { targets: [], isShared: true };
  return { targets: matched.map((m) => m.user_id), isShared: false };
}

export function ConfirmCards({
  workspaceId,
  members,
  schedules,
  onAllProcessed,
}: {
  workspaceId: string;
  members: WorkspaceMemberInfo[];
  schedules: AgentSchedule[];
  onAllProcessed: (summary: { registered: number; skipped: number }) => void;
}) {
  const { showToast } = useToast();
  const [cards, setCards] = useState<CardState[]>(() =>
    schedules.map((s) => {
      const { targets, isShared } = matchTargets(s.target_hint, members);
      return { schedule: s, status: "pending", title: s.title, targets, isShared };
    })
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const doneNotified = useRef(false);

  const total = cards.length;

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

  const updateCard = (index: number, patch: Partial<CardState>) => {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const handleSkip = (index: number) => {
    setCards((prev) => {
      const next = prev.map((c, i) => (i === index ? { ...c, status: "skipped" as CardStatus } : c));
      notifyIfDone(next);
      goToNextPending(index, next);
      return next;
    });
  };

  const handleRegister = async (index: number) => {
    const card = cards[index];
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
      is_grocery: false,
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

  const toggleTarget = (index: number, userId: string) => {
    const card = cards[index];
    const nextTargets = card.targets.includes(userId)
      ? card.targets.filter((id) => id !== userId)
      : [...card.targets, userId];
    updateCard(index, { targets: nextTargets, isShared: nextTargets.length === 0 });
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-[11px] text-stone">
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
          const group = KEYWORD_GROUPS.find((g) => g.main === card.schedule.keyword_main);
          const isDone = card.status !== "pending";
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
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{ color: group.color, backgroundColor: `${group.color}1A` }}
                  >
                    {group.main}
                  </span>
                ) : (
                  <span />
                )}
                {isDone && (
                  <span className="text-[11px] font-medium text-sage">
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
                  className="rounded-lg px-2 py-1 text-[15px] font-medium"
                />
              ) : (
                <button
                  onClick={() => !isDone && setEditingIndex(index)}
                  disabled={isDone}
                  className="flex items-center gap-1.5 text-left text-[15px] font-medium text-ink"
                >
                  {card.title}
                  {!isDone && <IconPencil size={13} className="text-stone" />}
                </button>
              )}

              <div className="flex flex-col gap-1 text-[12px] text-stone">
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
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    card.isShared ? "bg-ink text-cream" : "bg-cream text-stone"
                  }`}
                >
                  가족 전체
                </button>
                {members.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => toggleTarget(index, m.user_id)}
                    disabled={isDone}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      card.targets.includes(m.user_id) ? "bg-ink text-cream" : "bg-cream text-stone"
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
                    className="flex-1 rounded-xl bg-cream py-2 text-[13px] font-medium text-stone"
                  >
                    건너뛰기
                  </button>
                  <button
                    onClick={() => handleRegister(index)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-honey py-2 text-[13px] font-medium text-white"
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
