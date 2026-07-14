"use client";

import { useState } from "react";
import Link from "next/link";
import { buildCandidatePool } from "@/lib/mealUtils";
import { MealDecisionSheet } from "@/components/food/MealDecisionSheet";
import { FrequentMenuSection } from "@/components/food/FrequentMenuSection";
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
      <FrequentMenuSection workspaceId={workspaceId} selectedDate={selectedDate} />
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
