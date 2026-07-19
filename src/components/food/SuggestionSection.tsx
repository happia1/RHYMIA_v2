"use client";

import { useRef, useState } from "react";
import { IconSparkles, IconDice5, IconTrophy, IconLadder, IconUsers } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealDecisionSheet, type Mode as DecisionMode } from "@/components/food/MealDecisionSheet";
import { buildCandidatePool } from "@/lib/mealUtils";
import type { MealVote } from "@/types";

// "자주 찾는 메뉴"는 서로 다른 날짜 7일 이상의 끼니 기록이 쌓여야 의미 있는 통계라 콜드스타트를 건다.
const FREQUENT_MENU_MIN_DAYS = 7;

// "메뉴 고르기" 배너 — 설명 문구 없이 4가지 방식을 바로 칩으로 나열, 탭하면 그 모드로 시트가 연다.
// 태블릿 식탁 탭(FoodTabletHome)의 "오늘의 제안" 칩도 이 배열을 그대로 재사용한다.
export const DECISION_MODES: { mode: DecisionMode; label: string; icon: typeof IconDice5 }[] = [
  { mode: "roulette", label: "룰렛 돌리기", icon: IconDice5 },
  { mode: "worldcup", label: "이상형 월드컵", icon: IconTrophy },
  { mode: "ladder", label: "사다리", icon: IconLadder },
  { mode: "vote", label: "가족 투표", icon: IconUsers },
];

interface Slide {
  key: string;
  title: string;
  body?: string;
}

/** "오늘의 제안" — 전폭 카드 2장(자주 찾는 메뉴/메뉴 고르기)을 가로 스와이프 배너로
 * 보여준다. 스마트미러 톤 유지가 목적이라 카드에 배경/그림자를 주지 않고(박스감 최소),
 * 배너 안에서 설명과 액션 영역만 헤어라인으로 구획한다. "추천 레시피" 카드는 여기 있었으나
 * 식탁 탭 하단 "레시피" 섹션(RecipeSection)으로 옮겨 한 곳에 모았다. */
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
  const [decisionMode, setDecisionMode] = useState<DecisionMode>("roulette");
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const frequentMenuUnlocked = trackingDays >= FREQUENT_MENU_MIN_DAYS;

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const openDecision = (mode: DecisionMode) => {
    setDecisionMode(mode);
    setDecisionOpen(true);
  };

  const slides: Slide[] = [
    {
      key: "frequent",
      title: "자주 찾는 메뉴",
      body: frequentMenuUnlocked
        ? frequentMenus[0] ?? "아직 기록이 없어요"
        : `데이터 쌓는 중 (${trackingDays}/7일)`,
    },
    {
      key: "roulette",
      title: "메뉴 고르기",
    },
  ];

  return (
    <section className="flex flex-col gap-label-gap">
      <SectionLabel icon={<IconSparkles size={14} />}>오늘의 제안</SectionLabel>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((slide) => (
          <div key={slide.key} className="flex w-full shrink-0 snap-start flex-col gap-1.5">
            <span className="text-[13px] font-medium text-stone">{slide.title}</span>
            {slide.key === "roulette" ? (
              <div className="flex flex-wrap gap-2">
                {DECISION_MODES.map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => openDecision(m.mode)}
                    className="flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5 text-[14px] font-medium text-ink"
                  >
                    <m.icon size={14} className="text-honey" />
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[16px] text-ink">{slide.body}</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-1.5">
        {slides.map((slide, i) => (
          <span
            key={slide.key}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-4 bg-honey" : "w-1.5 bg-border-light"
            }`}
          />
        ))}
      </div>

      <MealDecisionSheet
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        workspaceId={workspaceId}
        selectedDate={selectedDate}
        candidatePool={buildCandidatePool(frequentMenus)}
        activeVote={activeVote}
        initialMode={decisionMode}
      />
    </section>
  );
}
