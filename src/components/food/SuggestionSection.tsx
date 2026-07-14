"use client";

import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import { buildCandidatePool } from "@/lib/mealUtils";
import type { MealVote } from "@/types";

// "자주 찾는 메뉴"는 서로 다른 날짜 7일 이상의 끼니 기록이 쌓여야 의미 있는 통계라 콜드스타트를 건다.
const FREQUENT_MENU_MIN_DAYS = 7;

export function SuggestionSection({
  workspaceId,
  selectedDate,
  frequentMenus,
  trackingDays,
  activeVote,
}: {
  workspaceId: string;
  selectedDate: string;
  frequentMenus: string[];
  /** 서로 다른 날짜 기준 끼니 기록 일수 — getMealTrackingDayCount(food/actions.ts) */
  trackingDays: number;
  activeVote: MealVote | null;
}) {
  const [decisionOpen, setDecisionOpen] = useState(false);
  const frequentMenuUnlocked = trackingDays >= FREQUENT_MENU_MIN_DAYS;

  const cards: { title: string; body: string; onClick?: () => void }[] = [
    {
      title: "자주 찾는 메뉴",
      body: frequentMenuUnlocked
        ? frequentMenus[0] ?? "아직 기록이 없어요"
        : `데이터 쌓는 중 (${trackingDays}/7일)`,
    },
    {
      title: "메뉴 고르기",
      body: "룰렛 돌리기",
      onClick: () => setDecisionOpen(true),
    },
    {
      title: "추천 레시피",
      body: "준비중",
    },
  ];

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={<IconSparkles size={14} />}>오늘의 제안</SectionLabel>
      <div className="flex divide-x divide-border-light">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={card.onClick}
            disabled={!card.onClick}
            className="flex flex-1 flex-col items-center gap-0.5 px-2 py-1 text-center disabled:cursor-default"
          >
            <span className="text-[11px] font-medium text-stone">{card.title}</span>
            <span className="text-[12px] text-[var(--text-muted)]">{card.body}</span>
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
