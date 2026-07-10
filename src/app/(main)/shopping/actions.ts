"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ShoppingItem } from "@/types";

/** 어느 탭에서든 열리는 글로벌 장바구니 시트가 열릴 때(마다) 최신 상태를 직접 조회한다 —
 * 시트가 (main)/layout.tsx 전역에 떠 있어서 특정 페이지의 revalidatePath만으로는
 * 다른 탭에 떠 있는 시트까지 갱신할 수 없기 때문에, 서버 컴포넌트 props 대신 이 방식을 쓴다. */
export async function getShoppingItems(workspaceId: string): Promise<ShoppingItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_item")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("added_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ShoppingItem[];
}

export interface CompleteGroceryRunInput {
  itemIds: string[];
  place?: string | null;
  amount?: number | null;
  receiptImageUrl?: string | null;
  addToFridge: boolean;
}

/** 시트 하단 "장보기 완료" — 오늘 체크된(아직 expense로 묶이지 않은) 항목들을
 * expense 기록 하나(category='grocery')로 묶고, 선택하면 fridge_item 재고에도 추가한다. */
export async function completeGroceryRun(workspaceId: string, input: CompleteGroceryRunInput) {
  if (input.itemIds.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: items, error: itemsError } = await supabase
    .from("shopping_item")
    .select("id, name")
    .in("id", input.itemIds);
  if (itemsError) throw new Error(itemsError.message);

  const { data: expense, error: expenseError } = await supabase
    .from("expense")
    .insert({
      workspace_id: workspaceId,
      category: "grocery",
      amount: input.amount ?? 0,
      date: new Date().toISOString().slice(0, 10),
      memo: input.place?.trim() || null,
      receipt_image_url: input.receiptImageUrl ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (expenseError) throw new Error(expenseError.message);

  const { error: linkError } = await supabase
    .from("shopping_item")
    .update({ expense_id: expense.id })
    .in("id", input.itemIds);
  if (linkError) throw new Error(linkError.message);

  if (input.addToFridge && items && items.length > 0) {
    const { error: fridgeError } = await supabase.from("fridge_item").insert(
      items.map((item) => ({
        workspace_id: workspaceId,
        name: item.name,
        category: "cold" as const,
        added_by: user.id,
      }))
    );
    if (fridgeError) throw new Error(fridgeError.message);
  }

  revalidatePath("/home");
  revalidatePath("/food");
  revalidatePath("/food/add");
}
