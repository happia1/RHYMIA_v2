"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconToolsKitchen2, IconLoader2 } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { copyRecipeImageToStorage } from "@/app/(main)/food/actions";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

const MEMO_STEP_COUNT = 3;

/** 식탁 탭 "추천 레시피" 배너 및 끼니 등록 "레시피 찾아보기"(검색 결과/즐겨찾기/최근 본)
 * 양쪽이 공유하는 상세 팝업 — 완성 사진, 재료, 조리 단계, 출처(식품안전나라 공공데이터) 표기.
 * 두 호출부의 "채우기" 동선이 서로 달라 하단 버튼 동작을 분기한다:
 * - onFillFromRecipe가 있으면(끼니 등록 화면 "안"에서 열린 경우) 그 콜백만 호출하고 끝 —
 *   이미 등록 화면 위에 떠 있으므로 페이지 이동 없이 그 자리에서 폼을 채운다.
 * - 없으면(식탁 탭 배너에서 열린 경우, selectedDate 필요) 완성 사진을 우리 Storage로
 *   복사한 뒤 끼니 등록 화면으로 이동해 메뉴명/이미지/재료/조리 요약을 프리필한다. */
export function RecipeDetailSheet({
  recipe,
  open,
  onClose,
  selectedDate,
  onFillFromRecipe,
}: {
  recipe: NormalizedRecipe | null;
  open: boolean;
  onClose: () => void;
  /** food 탭 배너에서 열렸을 때만 필요("오늘 메뉴로 추가하기"의 이동 대상 날짜) */
  selectedDate?: string;
  /** 끼니 등록 화면 안에서 열렸을 때만 전달 — 있으면 페이지 이동 대신 이 콜백으로 그 자리에서 채운다. */
  onFillFromRecipe?: (recipe: NormalizedRecipe) => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToToday = async () => {
    if (!recipe) return;

    if (onFillFromRecipe) {
      onFillFromRecipe(recipe);
      return;
    }

    setIsAdding(true);

    let imageUrl = "";
    if (recipe.image) {
      const result = await copyRecipeImageToStorage(recipe.image);
      if (result.ok) {
        imageUrl = result.url;
      } else {
        showToast("레시피 사진은 가져오지 못했지만 나머지 내용은 채워드릴게요.");
      }
    }

    const memoSummary = recipe.steps
      .slice(0, MEMO_STEP_COUNT)
      .map((s) => s.text)
      .join("\n");

    const params = new URLSearchParams({ date: selectedDate ?? "", menu: recipe.name });
    if (imageUrl) params.set("recipeImage", imageUrl);
    if (recipe.ingredients.length) params.set("recipeIngredients", recipe.ingredients.join(","));
    if (memoSummary) params.set("recipeMemo", memoSummary);

    setIsAdding(false);
    router.push(`/food/add?${params.toString()}`);
  };

  return (
    <BottomSheet open={open && !!recipe} onClose={onClose} tall>
      {recipe && (
        <div className="flex flex-col gap-4">
          <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-xl bg-cream">
            {recipe.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recipe.image} alt={recipe.name} className="h-full w-full object-cover" />
            ) : (
              <IconToolsKitchen2 size={32} className="text-[var(--text-muted)]" />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[19px] font-medium text-ink">{recipe.name}</span>
            <span className="text-[13px] text-[var(--text-muted)]">출처: 식품안전나라</span>
          </div>

          {recipe.ingredients.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[14px] font-medium text-stone">재료</span>
              <div className="flex flex-wrap gap-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <span
                    key={`${ing}-${i}`}
                    className="rounded-full bg-cream px-2.5 py-1 text-[14px] text-ink"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recipe.steps.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-[14px] font-medium text-stone">조리 단계</span>
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p className="text-[16px] leading-relaxed text-ink">{step.text}</p>
                  {step.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={step.image}
                      alt=""
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {recipe.tip && (
            <p className="rounded-xl bg-cream px-3 py-2.5 text-[14px] text-stone">
              💡 {recipe.tip}
            </p>
          )}

          <button
            onClick={handleAddToToday}
            disabled={isAdding}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[17px] font-medium text-cream disabled:opacity-60"
          >
            {isAdding && <IconLoader2 size={16} className="animate-spin" />}
            {onFillFromRecipe ? "이 레시피로 채우기" : "오늘 메뉴로 추가하기"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
