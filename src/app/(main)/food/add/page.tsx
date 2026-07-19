import { requireWorkspaceContext } from "@/lib/workspace";
import { toDateStr } from "@/lib/date";
import { AddMealScreen } from "@/components/food/AddMealScreen";
import type { FridgeItem } from "@/types";

export default async function AddMealPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    menu?: string;
    /** 추천 레시피 상세/레시피(내부) 검색 결과의 "오늘 메뉴로 추가하기"에서 넘어온 프리필 —
     * recipeImage는 이미 우리 Storage로 복사된 URL, recipeIngredients는 쉼표 구분,
     * recipeMemo는 조리 단계 요약(줄바꿈 포함) 그대로. */
    recipeImage?: string;
    recipeIngredients?: string;
    recipeMemo?: string;
  }>;
}) {
  const { date, menu, recipeImage, recipeIngredients, recipeMemo } = await searchParams;
  const { supabase, workspaceId } = await requireWorkspaceContext();

  const { data: fridgeItems } = await supabase
    .from("fridge_item")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  return (
    <AddMealScreen
      workspaceId={workspaceId}
      defaultDate={date ?? toDateStr(new Date())}
      defaultMenu={menu}
      prefillImageUrl={recipeImage}
      prefillIngredients={recipeIngredients?.split(",").filter(Boolean)}
      prefillMemo={recipeMemo}
      fridgeItems={(fridgeItems as FridgeItem[]) ?? []}
    />
  );
}
