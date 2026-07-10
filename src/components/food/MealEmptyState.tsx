"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createMeal } from "@/app/(main)/food/actions";
import { currentMealTag, buildCandidatePool } from "@/lib/mealUtils";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import type { MealVote } from "@/types";

export function MealEmptyState({
  workspaceId,
  selectedDate,
  frequentMenus,
  activeVote,
}: {
  workspaceId: string;
  selectedDate: string;
  frequentMenus: string[];
  activeVote: MealVote | null;
}) {
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const quickRegister = (menu: string) => {
    startTransition(() => {
      createMeal(workspaceId, {
        date: selectedDate,
        tag: currentMealTag(),
        type: "집밥",
        main_menu: menu,
        sides: [],
        place: null,
        reservation_time: null,
        memo: null,
      });
    });
  };

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-[14px] text-[var(--text-muted)]">메뉴 고르는 중 🤔</p>
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
