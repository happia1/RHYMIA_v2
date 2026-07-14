import { requireWorkspaceContext } from "@/lib/workspace";
import { toDateStr } from "@/lib/date";
import { isRecipeSearchEnabled } from "@/lib/recipeSearch";
import { AddMealScreen } from "@/components/food/AddMealScreen";
import type { FridgeItem } from "@/types";

export default async function AddMealPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; menu?: string }>;
}) {
  const { date, menu } = await searchParams;
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
      fridgeItems={(fridgeItems as FridgeItem[]) ?? []}
      recipeSearchEnabled={isRecipeSearchEnabled()}
    />
  );
}
