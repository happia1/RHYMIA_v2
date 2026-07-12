"use client";

import { MealCard, type MealCardParticipant } from "@/components/food/MealCard";
import { SectionExpand } from "@/components/ui/SectionExpand";
import type { Meal } from "@/types";
import type { WorkspaceMemberInfo } from "@/lib/members";

const MEAL_LIST_PREVIEW_COUNT = 4;

export interface MealRow extends Meal {
  meal_participation?: { user_id: string; status: boolean | null }[];
}

/** 식탁 탭 "오늘 식탁" 목록 — 페이지(서버 컴포넌트)에서 SectionExpand(클라이언트 컴포넌트)에
 * 직접 renderItem 함수를 넘길 수 없어(서버→클라이언트로 함수 prop 전달 불가) 이 클라이언트
 * 래퍼가 데이터만 받아 내부에서 렌더 함수를 만든다. */
export function MealListSection({
  meals,
  members,
  currentUserId,
  nutritionEnabled = true,
}: {
  meals: MealRow[];
  members: WorkspaceMemberInfo[];
  currentUserId: string;
  nutritionEnabled?: boolean;
}) {
  const renderMeal = (meal: MealRow, i: number) => {
    const participation = meal.meal_participation ?? [];
    const participants: MealCardParticipant[] = participation
      .filter((p) => p.status === true)
      .map((p) => {
        const m = members.find((mm) => mm.user_id === p.user_id);
        return {
          user_id: p.user_id,
          display_name: m?.display_name ?? "가족",
          avatar_color: m?.avatar_color ?? "#E1F5EE",
          avatar_text_color: m?.avatar_text_color ?? "#0F6E56",
          avatar_image_url: m?.avatar_image_url ?? null,
        };
      });
    const myParticipation =
      participation.find((p) => p.user_id === currentUserId)?.status ?? null;

    return (
      <div key={meal.id} className={i > 0 ? "border-t border-border-light" : ""}>
        <MealCard
          meal={meal}
          participants={participants}
          myParticipation={myParticipation}
          nutritionEnabled={nutritionEnabled}
        />
      </div>
    );
  };

  return (
    <SectionExpand items={meals} pageSize={MEAL_LIST_PREVIEW_COUNT} renderItem={renderMeal} />
  );
}
