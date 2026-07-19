"use client";

import { IconStar, IconStarFilled, IconToolsKitchen2 } from "@tabler/icons-react";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

/** 레시피(내부) 목록 한 줄 — 검색 결과/내 레시피 노트/최근 본 레시피 목록이 공유한다
 * (RecipeSearchSheet, RecipeNoteSheet). 탭하면 상세 시트(RecipeDetailSheet)를 열고,
 * 별은 그 자리에서 즐겨찾기를 토글한다. */
export function RecipeRow({
  recipe,
  isFavorite,
  onToggleFavorite,
  onOpen,
  divider,
}: {
  recipe: NormalizedRecipe;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
  divider: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 py-2 ${divider ? "border-t border-border-light" : ""}`}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream">
          {recipe.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconToolsKitchen2 size={20} className="text-[var(--text-muted)]" />
          )}
        </div>
        <span className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium text-ink">{recipe.name}</span>
      </button>
      <button
        onClick={onToggleFavorite}
        aria-label={isFavorite ? "레시피 노트에서 빼기" : "레시피 노트에 저장"}
        className="shrink-0 p-1.5 -m-1.5"
      >
        {isFavorite ? (
          <IconStarFilled size={18} className="text-honey" />
        ) : (
          <IconStar size={18} className="text-[var(--text-muted)]" />
        )}
      </button>
    </div>
  );
}
