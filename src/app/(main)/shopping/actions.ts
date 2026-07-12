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
  /** YYYY-MM-DD, 생략 시 오늘 — "장보기 기록" 탭 "기록 직접 추가"에서 과거 날짜 지정용 */
  date?: string;
  addToFridge: boolean;
}

/** 장보기 완료(체크된 항목을 expense로 묶음)와 "기록 직접 추가"(품목 연결 없이 구매처/금액만
 * expense로 남김) 둘 다 이 함수를 공유한다 — itemIds가 비어 있으면 품목 조회/연결/재고 추가를
 * 전부 건너뛰고 expense(category='grocery') 행만 만든다. itemIds가 있는데 실제로 묶을 수 있는
 * 항목이 하나도 없으면(다른 워크스페이스/이미 묶임/미구매 등) 에러로 처리 — 클라이언트가 넘긴
 * itemIds를 그대로 믿지 않고 워크스페이스/구매 상태/미그룹핑 여부로 다시 필터링한다. */
export async function completeGroceryRun(workspaceId: string, input: CompleteGroceryRunInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "로그인이 필요해요." };

  let items: { id: string; name: string }[] = [];
  if (input.itemIds.length > 0) {
    const { data, error: itemsError } = await supabase
      .from("shopping_item")
      .select("id, name")
      .in("id", input.itemIds)
      .eq("workspace_id", workspaceId)
      .eq("is_purchased", true)
      .is("expense_id", null);
    if (itemsError) throw new Error(itemsError.message);
    if (!data || data.length === 0) {
      return { ok: false as const, message: "묶을 항목이 없어요." };
    }
    items = data;
  }

  const { data: expense, error: expenseError } = await supabase
    .from("expense")
    .insert({
      workspace_id: workspaceId,
      category: "grocery",
      amount: input.amount ?? 0,
      date: input.date || new Date().toISOString().slice(0, 10),
      place: input.place?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (expenseError) throw new Error(expenseError.message);

  if (items.length > 0) {
    const itemIds = items.map((item) => item.id);

    const { error: linkError } = await supabase
      .from("shopping_item")
      .update({ expense_id: expense.id })
      .in("id", itemIds)
      .eq("workspace_id", workspaceId)
      .eq("is_purchased", true)
      .is("expense_id", null);
    if (linkError) throw new Error(linkError.message);

    if (input.addToFridge) {
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
  }

  revalidatePath("/home");
  revalidatePath("/food");
  revalidatePath("/food/add");
  return { ok: true as const };
}

export interface GroceryRun {
  id: string;
  date: string;
  place: string | null;
  amount: number;
  receiptImageUrl: string | null;
  itemNames: string[];
}

type ExpenseRow = {
  id: string;
  date: string;
  place: string | null;
  amount: number;
  receipt_image_url: string | null;
};

/** expense 행들 + (이미 expense_id IN (...)로 한 번에 조회해온) shopping_item 행들을
 * 회차별로 묶는다 — N+1 방지를 위해 호출부가 두 조회를 각각 한 번씩만 하고 이 함수에 넘긴다. */
function groupRuns(
  expenses: ExpenseRow[],
  shoppingItems: { expense_id: string | null; name: string }[]
): GroceryRun[] {
  const namesByExpense: Record<string, string[]> = {};
  for (const item of shoppingItems) {
    if (!item.expense_id) continue;
    (namesByExpense[item.expense_id] ??= []).push(item.name);
  }
  return expenses.map((e) => ({
    id: e.id,
    date: e.date,
    place: e.place,
    amount: e.amount,
    receiptImageUrl: e.receipt_image_url,
    itemNames: namesByExpense[e.id] ?? [],
  }));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** 장보기 기록 탭의 월별 조회 — expense(category='grocery') + 연결된 shopping_item 이름들.
 * 품목 조회는 회차 수와 무관하게 expense_id IN (...) 한 번으로 끝난다(N+1 방지). */
export async function getGroceryRuns(workspaceId: string, year: number, month: number) {
  const supabase = await createClient();
  const monthStart = `${year}-${pad2(month + 1)}-01`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`;

  const { data: expenses, error: expenseError } = await supabase
    .from("expense")
    .select("id, date, place, amount, receipt_image_url")
    .eq("workspace_id", workspaceId)
    .eq("category", "grocery")
    .gte("date", monthStart)
    .lte("date", monthEnd)
    .order("date", { ascending: false });
  if (expenseError) return { ok: false as const, message: expenseError.message };

  const expenseIds = (expenses ?? []).map((e) => e.id);
  const { data: shoppingItems, error: itemsError } = expenseIds.length
    ? await supabase.from("shopping_item").select("expense_id, name").in("expense_id", expenseIds)
    : { data: [], error: null };
  if (itemsError) return { ok: false as const, message: itemsError.message };

  return { ok: true as const, runs: groupRuns(expenses ?? [], shoppingItems ?? []) };
}

/** 장보기 기록 검색 — 품목명(shopping_item.name) 또는 구매처(expense.place) 부분일치,
 * 최신순 20건. 사용자 입력을 raw 필터 문자열에 끼워넣지 않고 .ilike()/.in() 파라미터로만
 * 전달해 필터 인젝션을 피한다. */
export async function searchGroceryRuns(workspaceId: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return { ok: true as const, runs: [] as GroceryRun[] };

  const supabase = await createClient();
  const pattern = `%${trimmed}%`;

  const [placeResult, itemResult] = await Promise.all([
    supabase
      .from("expense")
      .select("id, date, place, amount, receipt_image_url")
      .eq("workspace_id", workspaceId)
      .eq("category", "grocery")
      .ilike("place", pattern),
    supabase
      .from("shopping_item")
      .select("expense_id")
      .eq("workspace_id", workspaceId)
      .ilike("name", pattern)
      .not("expense_id", "is", null),
  ]);
  if (placeResult.error) return { ok: false as const, message: placeResult.error.message };
  if (itemResult.error) return { ok: false as const, message: itemResult.error.message };

  const itemExpenseIds = Array.from(
    new Set((itemResult.data ?? []).map((i) => i.expense_id).filter((id): id is string => !!id))
  );

  let itemMatchedExpenses: ExpenseRow[] = [];
  if (itemExpenseIds.length > 0) {
    const { data, error } = await supabase
      .from("expense")
      .select("id, date, place, amount, receipt_image_url")
      .eq("workspace_id", workspaceId)
      .eq("category", "grocery")
      .in("id", itemExpenseIds);
    if (error) return { ok: false as const, message: error.message };
    itemMatchedExpenses = data ?? [];
  }

  const mergedById = new Map<string, ExpenseRow>();
  for (const e of [...(placeResult.data ?? []), ...itemMatchedExpenses]) mergedById.set(e.id, e);
  const merged = Array.from(mergedById.values())
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20);

  const expenseIds = merged.map((e) => e.id);
  const { data: shoppingItems, error: shoppingError } = expenseIds.length
    ? await supabase.from("shopping_item").select("expense_id, name").in("expense_id", expenseIds)
    : { data: [], error: null };
  if (shoppingError) return { ok: false as const, message: shoppingError.message };

  return { ok: true as const, runs: groupRuns(merged, shoppingItems ?? []) };
}
