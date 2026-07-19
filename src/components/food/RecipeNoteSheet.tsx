"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { RecipeRow } from "@/components/food/RecipeRow";
import { RecipeDetailSheet } from "@/components/food/RecipeDetailSheet";
import { getRecipeNotes, toggleRecipeFavorite, recordRecipeViewed } from "@/app/(main)/food/actions";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

/** "레시피 노트"(즐겨찾기) 목록 — 태블릿 식탁 탭의 "레시피 노트 N ›" 진입점 전용. 끼니
 * 등록 화면 RecipeSearchSheet의 즐겨찾기 섹션과 같은 데이터(getRecipeNotes)/토글
 * (toggleRecipeFavorite)/행(RecipeRow)을 그대로 재사용하고, 여기서는 검색 없이 즐겨찾기
 * 목록만 보여준다. 항목을 열면 RecipeDetailSheet가 "오늘 메뉴로 추가하기"(selectedDate
 * 기준 페이지 이동) 흐름으로 이어진다 — 끼니 등록 화면 "안"이 아니라 식탁 탭에서 열렸기 때문. */
export function RecipeNoteSheet({
  open,
  onClose,
  workspaceId,
  selectedDate,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  selectedDate: string;
}) {
  const [favorites, setFavorites] = useState<NormalizedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detailRecipe, setDetailRecipe] = useState<NormalizedRecipe | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    getRecipeNotes(workspaceId).then((result) => {
      setFavorites(result.favorites);
      setIsLoading(false);
    });
  }, [open, workspaceId]);

  // 이 시트는 즐겨찾기만 보여주므로 여기서 별 토글은 사실상 항상 "빼기" — 낙관적으로
  // 바로 지우고, 실패했거나(드물게) 여전히 즐겨찾기 상태로 응답이 오면 되돌린다.
  const handleToggleFavorite = async (recipe: NormalizedRecipe) => {
    setFavorites((prev) => prev.filter((r) => r.id !== recipe.id));
    const result = await toggleRecipeFavorite(workspaceId, recipe);
    if (!result.ok || result.isFavorite) {
      setFavorites((prev) => [recipe, ...prev]);
    }
  };

  const handleOpenDetail = (recipe: NormalizedRecipe) => {
    setDetailRecipe(recipe);
    recordRecipeViewed(workspaceId, recipe);
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} fixedHeight>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <span className="text-[15px] font-medium text-ink">레시피 노트</span>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">불러오는 중...</p>
            )}
            {!isLoading && favorites.length === 0 && (
              <p className="py-6 text-center text-[13px] text-[var(--text-muted)]">
                별을 눌러 레시피를 저장해보세요
              </p>
            )}
            {favorites.map((r, i) => (
              <RecipeRow
                key={r.id}
                recipe={r}
                isFavorite
                onToggleFavorite={() => handleToggleFavorite(r)}
                onOpen={() => handleOpenDetail(r)}
                divider={i > 0}
              />
            ))}
          </div>
        </div>
      </BottomSheet>

      <RecipeDetailSheet
        recipe={detailRecipe}
        open={!!detailRecipe}
        onClose={() => setDetailRecipe(null)}
        selectedDate={selectedDate}
      />
    </>
  );
}
