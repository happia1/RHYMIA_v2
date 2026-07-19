import { notFound } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/workspace";
import { AddMealScreen } from "@/components/food/AddMealScreen";
import type { FridgeItem, Meal } from "@/types";

export default async function EditMealPage({
  params,
}: {
  params: Promise<{ mealId: string }>;
}) {
  const { mealId } = await params;
  const { supabase, workspaceId } = await requireWorkspaceContext();

  const [{ data: meal }, { data: fridgeItems }] = await Promise.all([
    supabase
      .from("meal")
      .select("*")
      .eq("id", mealId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("fridge_item")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  if (!meal) notFound();

  return (
    <AddMealScreen
      workspaceId={workspaceId}
      defaultDate={meal.date}
      fridgeItems={(fridgeItems as FridgeItem[]) ?? []}
      existingMeal={meal as Meal}
    />
  );
}
