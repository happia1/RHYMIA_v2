"use client";

import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import { mirror } from "@/lib/homeTheme";
import { buildCandidatePool } from "@/lib/mealUtils";
import type { MealVote } from "@/types";

export function SuggestionSection({
  workspaceId,
  selectedDate,
  frequentMenus,
  weekendSuggestion,
  activeVote,
}: {
  workspaceId: string;
  selectedDate: string;
  frequentMenus: string[];
  weekendSuggestion: string;
  activeVote: MealVote | null;
}) {
  const [decisionOpen, setDecisionOpen] = useState(false);

  const cards: { title: string; body: string; onClick?: () => void }[] = [
    {
      title: "늘 먹던 메뉴",
      body: frequentMenus[0] ?? "아직 기록이 없어요",
    },
    {
      title: "룰렛 돌리기",
      body: "메뉴를 랜덤으로 골라드려요",
      onClick: () => setDecisionOpen(true),
    },
    {
      title: "주말엔 이런 건 어때요",
      body: weekendSuggestion,
    },
    {
      title: "냉장고 재고 추천",
      body: "준비 중이에요",
    },
  ];

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={<IconSparkles size={14} />}>오늘의 제안</SectionLabel>
      <div className="flex gap-3 overflow-x-auto pb-1 pl-section-indent">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={card.onClick}
            disabled={!card.onClick}
            className="flex w-36 shrink-0 flex-col gap-1 rounded-2xl border border-border-light p-3 text-left disabled:cursor-default"
          >
            <span className={`text-[11px] font-medium ${mirror.muted}`}>{card.title}</span>
            <span className={`text-[14px] ${mirror.primary}`}>{card.body}</span>
          </button>
        ))}
      </div>
      <MealDecisionSheet
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        workspaceId={workspaceId}
        selectedDate={selectedDate}
        candidatePool={buildCandidatePool(frequentMenus)}
        activeVote={activeVote}
      />
    </section>
  );
}
