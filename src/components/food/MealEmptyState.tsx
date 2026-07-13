"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createMeal } from "@/app/(main)/food/actions";
import { currentMealTag, buildCandidatePool } from "@/lib/mealUtils";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import type { MealType, MealVote } from "@/types";

export interface MealHistoryRow {
  main_menu: string;
  date: string;
  type: MealType;
  sides: string[];
  memo: string | null;
  place: string | null;
  image_url: string | null;
  video_id: string | null;
  recipe_title: string | null;
}

/** menu 문자열과 정확히 일치하는(콤마로 여러 메뉴를 묶어 저장한 행은 토큰 단위로 비교) 가장
 * 최근 기록을 찾는다 — "늘 먹던 걸로" 빠른 등록이 그 기록의 이미지·메모·반찬 등을 그대로
 * 복사해오기 위함. 일치하는 기록이 없으면 null(그래도 메뉴명만으로 등록은 됨). */
function findLatestMealForMenu(rows: MealHistoryRow[], menu: string): MealHistoryRow | null {
  let best: MealHistoryRow | null = null;
  for (const row of rows) {
    const tokens = row.main_menu.split(",").map((s) => s.trim());
    if (!tokens.includes(menu)) continue;
    if (!best || row.date > best.date) best = row;
  }
  return best;
}

export function MealEmptyState({
  workspaceId,
  selectedDate,
  frequentMenus,
  recentMeals,
  activeVote,
}: {
  workspaceId: string;
  selectedDate: string;
  frequentMenus: string[];
  /** 최근 200건 끼니 기록 — "늘 먹던 걸로" 클릭 시 이미지/메모/반찬을 복사할 원본을 찾는 용도 */
  recentMeals: MealHistoryRow[];
  activeVote: MealVote | null;
}) {
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const quickRegister = (menu: string) => {
    const source = findLatestMealForMenu(recentMeals, menu);
    startTransition(() => {
      createMeal(workspaceId, {
        date: selectedDate,
        tag: currentMealTag(),
        type: source?.type ?? "집밥",
        main_menu: menu,
        sides: source?.sides ?? [],
        place: source?.type === "외식" ? source.place : null,
        reservation_time: null,
        memo: source?.memo ?? null,
        image_url: source?.image_url ?? null,
        video_id: source?.video_id ?? null,
        recipe_title: source?.recipe_title ?? null,
      });
    });
  };

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-[14px] text-[var(--text-muted)]">메뉴 고르는 중</p>
      <div className="flex gap-2">
        <Link
          href={`/food/add?date=${selectedDate}`}
          className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-cream"
        >
          직접 등록
        </Link>
        <button
          onClick={() => setDecisionOpen(true)}
          className="rounded-full bg-cream px-4 py-2 text-[13px] font-medium text-stone"
        >
          대신 골라줘
        </button>
      </div>
      {frequentMenus.length > 0 && (
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <span className="text-[11px] text-[var(--text-muted)]">늘 먹던 걸로</span>
          <div className="flex flex-wrap justify-center gap-2">
            {frequentMenus.map((menu) => (
              <button
                key={menu}
                onClick={() => quickRegister(menu)}
                disabled={isPending}
                className="rounded-full border border-border-light px-3 py-1.5 text-[12px] text-ink disabled:opacity-50"
              >
                {menu}
              </button>
            ))}
          </div>
        </div>
      )}
      <MealDecisionSheet
        open={decisionOpen}
        onClose={() => setDecisionOpen(false)}
        workspaceId={workspaceId}
        selectedDate={selectedDate}
        candidatePool={buildCandidatePool(frequentMenus)}
        activeVote={activeVote}
      />
    </div>
  );
}
