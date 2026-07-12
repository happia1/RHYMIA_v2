import { mealKcalMedian } from "@/lib/mealUtils";
import type { Meal } from "@/types";

const PRIMARY_TAGS = ["아침", "점심", "저녁"];

/** 식탁 탭 선택일 목록 하단(헤어라인 위) — 그날 등록된 끼니의 kcal 중앙값 합계를 한 줄로.
 * 추정치가 하나도 없으면 아무것도 렌더하지 않는다("기본은 낮은 존재감" — 빈 자리를 만들지
 * 않기). 추정 안 된 끼니가 하나라도 섞여 있으면 합계 뒤에 "+"를 붙여 전부 합산된 게
 * 아님을 표시한다. 태그는 아침/점심/저녁을 먼저, 그다음 그날 등장한 다른 태그(간식 등)를
 * 있는 순서대로 나열 — 그 태그에 추정치가 하나도 없으면 통째로 생략한다. */
export function MealNutritionSummary({
  dateLabel,
  meals,
}: {
  dateLabel: string;
  meals: Pick<Meal, "tag" | "kcal_min" | "kcal_max">[];
}) {
  const withEstimate = meals
    .map((m) => ({ tag: m.tag, kcal: mealKcalMedian(m) }))
    .filter((m): m is { tag: string; kcal: number } => m.kcal != null);

  if (withEstimate.length === 0) return null;

  const total = withEstimate.reduce((sum, m) => sum + m.kcal, 0);
  const hasUnestimated = withEstimate.length < meals.length;

  const otherTags = Array.from(new Set(withEstimate.map((m) => m.tag))).filter(
    (t) => !PRIMARY_TAGS.includes(t)
  );
  const byTag = [...PRIMARY_TAGS, ...otherTags]
    .map((tag) => {
      const kcal = withEstimate
        .filter((m) => m.tag === tag)
        .reduce((sum, m) => sum + m.kcal, 0);
      return kcal > 0 ? `${tag} ${kcal}` : null;
    })
    .filter((s): s is string => s !== null);

  return (
    <p className="border-t border-border-light pt-2.5 text-[12px] text-[var(--text-secondary)]">
      {dateLabel} 약 {total}kcal{hasUnestimated ? "+" : ""}
      {byTag.length > 0 && ` · ${byTag.join(" · ")}`}
    </p>
  );
}
