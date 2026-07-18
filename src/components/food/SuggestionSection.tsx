"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSparkles } from "@tabler/icons-react";
import { SectionLabel } from "@/components/home/SectionLabel";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import { RecipeDetailSheet } from "@/components/food/RecipeDetailSheet";
import { buildCandidatePool } from "@/lib/mealUtils";
import type { MealVote } from "@/types";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

// "자주 찾는 메뉴"는 서로 다른 날짜 7일 이상의 끼니 기록이 쌓여야 의미 있는 통계라 콜드스타트를 건다.
const FREQUENT_MENU_MIN_DAYS = 7;

interface Slide {
  key: string;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

/** "오늘의 제안" — 전폭 카드 3장(자주 찾는 메뉴/메뉴 고르기/추천 레시피)을 가로 스와이프
 * 배너로 보여준다. 스마트미러 톤 유지가 목적이라 카드에 배경/그림자를 주지 않고(박스감 최소),
 * 배너 안에서 설명과 액션 영역만 헤어라인으로 구획한다. */
export function SuggestionSection({
  workspaceId,
  selectedDate,
  frequentMenus,
  trackingDays,
  activeVote,
  recommendedRecipe,
  recipeEnabled,
}: {
  workspaceId: string;
  selectedDate: string;
  frequentMenus: string[];
  /** 서로 다른 날짜 기준 끼니 기록 일수 — getMealTrackingDayCount(food/actions.ts) */
  trackingDays: number;
  activeVote: MealVote | null;
  /** 오늘의 추천 레시피(식품안전나라, 날짜 시드로 매일 갱신) — 게이트가 꺼져 있거나 조회
   * 실패 시 null. */
  recommendedRecipe: NormalizedRecipe | null;
  /** FOOD_SAFETY_API_KEY 설정 여부 — 꺼져 있으면 배너에 "준비 중"만 표시. */
  recipeEnabled: boolean;
}) {
  const router = useRouter();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const frequentMenuUnlocked = trackingDays >= FREQUENT_MENU_MIN_DAYS;

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const recipeBody = !recipeEnabled
    ? "준비 중"
    : recommendedRecipe
    ? recommendedRecipe.name
    : "잠시 후 다시 시도해주세요";

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
      body: "오늘 뭐 먹을지 룰렛으로 정해보세요",
      action: { label: "룰렛 돌리기", onClick: () => setDecisionOpen(true) },
    },
    {
      key: "recipe",
      title: "추천 레시피",
      body: recipeBody,
      action: recipeEnabled
        ? recommendedRecipe
          ? { label: "레시피 보기", onClick: () => setRecipeOpen(true) }
          : { label: "다시 시도", onClick: () => router.refresh() }
        : undefined,
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
            <span className="text-[11px] font-medium text-stone">{slide.title}</span>
            <span className="text-[13px] text-ink">{slide.body}</span>
            {slide.action && (
              <div className="border-t border-border-light pt-1.5">
                <button
                  onClick={slide.action.onClick}
                  className="text-[12px] font-medium text-honey"
                >
                  {slide.action.label}
                </button>
              </div>
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
      />

      <RecipeDetailSheet
        recipe={recommendedRecipe}
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
        selectedDate={selectedDate}
      />
    </section>
  );
}
