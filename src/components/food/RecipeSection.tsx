"use client";

import { useState } from "react";
import { IconToolsKitchen2, IconSearch } from "@tabler/icons-react";
import { mirror } from "@/lib/homeTheme";
import { SectionLabel } from "@/components/home/SectionLabel";
import { RecipeDetailSheet } from "@/components/food/RecipeDetailSheet";
import { RecipeNoteSheet } from "@/components/food/RecipeNoteSheet";
import { RecipeSearchSheet } from "@/components/food/RecipeSearchSheet";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";

/** 식탁 탭 하단 공용 "레시피" 섹션 — 모바일·태블릿이 완전히 동일하게 재사용한다. 오늘의
 * 추천 1건(식품안전나라, 날짜 시드) · 레시피 노트 진입 · 레시피 찾아보기(검색 시트)를 한
 * 곳에 모았다. 예전엔 "오늘의 제안" 배너 안 "추천 레시피" 카드(SuggestionSection)와 끼니
 * 등록 화면 안의 검색 시트로 나뉘어 있던 걸 여기 하나로 합침 — 끼니 등록 화면의 "레시피
 * 찾아보기"는 이제 이 섹션으로 연결만 하고(autoOpenSearch), 실제 검색은 여기서 한다. */
export function RecipeSection({
  workspaceId,
  selectedDate,
  recipeEnabled,
  recommendedRecipe,
  recipeNotesCount,
  blogSearchEnabled,
  autoOpenSearch = false,
}: {
  workspaceId: string;
  selectedDate: string;
  /** FOOD_SAFETY_API_KEY 설정 여부 — 오늘의 추천/레시피(내부) 검색 탭 게이트 겸용. */
  recipeEnabled: boolean;
  recommendedRecipe: NormalizedRecipe | null;
  recipeNotesCount: number;
  /** NAVER_CLIENT_ID/SECRET 설정 여부 — 레시피 찾아보기의 블로그 탭 게이트. */
  blogSearchEnabled: boolean;
  /** 끼니 등록 화면 "레시피 찾아보기"에서 연결되어 들어왔을 때 검색 시트를 바로 연다. */
  autoOpenSearch?: boolean;
}) {
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(autoOpenSearch);

  const body = !recipeEnabled
    ? "준비 중"
    : recommendedRecipe
    ? recommendedRecipe.name
    : "잠시 후 다시 시도해주세요";

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel icon={<IconToolsKitchen2 size={14} />}>레시피</SectionLabel>
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setRecipeOpen(true)}
          disabled={!recipeEnabled || !recommendedRecipe}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream">
            {recommendedRecipe?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={recommendedRecipe.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <IconToolsKitchen2 size={20} className={mirror.muted} />
            )}
          </div>
          <span className="flex min-w-0 flex-col">
            <span className={`text-[12px] ${mirror.muted}`}>오늘의 추천</span>
            <span className={`truncate text-[16px] font-semibold ${mirror.primary}`}>{body}</span>
          </span>
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className={`flex shrink-0 items-center gap-1 text-[13px] font-medium ${mirror.muted}`}
        >
          <IconSearch size={13} />
          찾아보기
        </button>
        <button onClick={() => setNotesOpen(true)} className="shrink-0 text-[13px] font-medium text-honey">
          레시피 노트 {recipeNotesCount} ›
        </button>
      </div>

      <RecipeDetailSheet
        recipe={recommendedRecipe}
        open={recipeOpen}
        onClose={() => setRecipeOpen(false)}
        selectedDate={selectedDate}
      />

      <RecipeNoteSheet
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        workspaceId={workspaceId}
        selectedDate={selectedDate}
      />

      <RecipeSearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        workspaceId={workspaceId}
        defaultQuery=""
        blogEnabled={blogSearchEnabled}
        internalEnabled={recipeEnabled}
        selectedDate={selectedDate}
      />
    </div>
  );
}
