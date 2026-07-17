"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconToolsKitchen2, IconLoader2 } from "@tabler/icons-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { copyRecipeImageToStorage } from "@/app/(main)/food/actions";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

const MEMO_STEP_COUNT = 3;

/** 식탁 탭 "추천 레시피" 배너 및 끼니 등록 "레시피(내부) 검색" 결과 양쪽이 공유하는 상세
 * 팝업 — 완성 사진, 재료, 조리 단계, 출처(식품안전나라 공공데이터) 표기. 하단 "오늘 메뉴로
 * 추가하기"는 완성 사진을 우리 Storage로 복사(공공데이터라 재배포 허용)한 뒤 끼니 등록
 * 화면으로 이동해 메뉴명/이미지/재료/조리 요약을 프리필한다 — 등록 자체는 사용자가 폼에서
 * 확인 후 직접 저장. */
export function RecipeDetailSheet({
  recipe,
  open,
  onClose,
  selectedDate,
}: {
  recipe: NormalizedRecipe | null;
  open: boolean;
  onClose: () => void;
  selectedDate: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToToday = async () => {
    if (!recipe) return;
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

    const params = new URLSearchParams({ date: selectedDate, menu: recipe.name });
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
            <span className="text-[16px] font-medium text-ink">{recipe.name}</span>
            <span className="text-[11px] text-[var(--text-muted)]">출처: 식품안전나라</span>
          </div>

          {recipe.ingredients.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-stone">재료</span>
              <div className="flex flex-wrap gap-1.5">
                {recipe.ingredients.map((ing, i) => (
                  <span
                    key={`${ing}-${i}`}
                    className="rounded-full bg-cream px-2.5 py-1 text-[12px] text-ink"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recipe.steps.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-medium text-stone">조리 단계</span>
              {recipe.steps.map((step, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p className="text-[13px] leading-relaxed text-ink">{step.text}</p>
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
            <p className="rounded-xl bg-cream px-3 py-2.5 text-[12px] text-stone">
              💡 {recipe.tip}
            </p>
          )}

          <button
            onClick={handleAddToToday}
            disabled={isAdding}
            className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-ink text-[14px] font-medium text-cream disabled:opacity-60"
          >
            {isAdding && <IconLoader2 size={16} className="animate-spin" />}
            오늘 메뉴로 추가하기
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
