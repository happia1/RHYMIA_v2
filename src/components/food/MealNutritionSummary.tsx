import { mealKcalMedian } from "@/lib/mealUtils";
import type { Meal } from "@/types";

/** 식탁 탭 선택일 목록 하단 — "+ 끼니 추가"와 한 줄에 나란히(왼쪽) 놓이는 그날 kcal 중앙값
 * 합계. 줄 자체의 구분선·정렬은 호출부(food/page.tsx)가 담당하고, 이 컴포넌트는 텍스트만
 * 낸다. 추정치가 하나도 없으면 아무것도 렌더하지 않는다("기본은 낮은 존재감" — 빈 자리를
 * 만들지 않기). 추정 안 된 끼니가 하나라도 섞여 있으면 합계 뒤에 "+"를 붙여 전부 합산된 게
 * 아님을 표시한다. 날짜 표기·끼니별(아침/점심/저녁) 분해는 없고 "총 약 N kcal 추정" 한
 * 줄만 남긴다. */
export function MealNutritionSummary({
  meals,
}: {
  meals: Pick<Meal, "kcal_min" | "kcal_max">[];
}) {
  const estimates = meals.map((m) => mealKcalMedian(m)).filter((k): k is number => k != null);

  if (estimates.length === 0) return null;

  const total = estimates.reduce((sum, k) => sum + k, 0);
  const hasUnestimated = estimates.length < meals.length;

  return (
    <span className="text-[12px] text-[var(--text-secondary)]">
      총 약 {total.toLocaleString()}kcal{hasUnestimated ? "+" : ""} 추정
    </span>
  );
}
