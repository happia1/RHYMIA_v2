"use client";

import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import { mirror } from "@/lib/homeTheme";
import { buildCandidatePool } from "@/lib/mealUtils";
import type { MealVote } from "@/types";

// "늘 먹던 메뉴"는 서로 다른 날짜 7일 이상의 끼니 기록이 쌓여야 의미 있는 통계라 콜드스타트를 건다.
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
      title: "늘 먹던 메뉴",
      body: frequentMenuUnlocked
        ? frequentMenus[0] ?? "아직 기록이 없어요"
        : `식탁 기록이 7일 쌓이면 열려요 (지금 ${trackingDays}일째)`,
    },
    {
      title: "룰렛 돌리기",
      body: "메뉴 랜덤 고르기",
      onClick: () => setDecisionOpen(true),
    },
    {
      title: "추천 레시피",
      body: "서비스 준비중",
    },
  ];

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={<IconSparkles size={14} />}>오늘의 제안</SectionLabel>
      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1 pl-section-indent">
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
