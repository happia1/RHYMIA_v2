"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callAgentServer } from "@/lib/agentServer";
import type { FridgeCategory, MealNutritionEstimate, MealType } from "@/types";

export interface MealInput {
  date: string;
  tag: string;
  type: MealType;
  main_menu: string;
  sides: string[];
  place?: string | null;
  reservation_time?: string | null;
  memo?: string | null;
  emoji?: string;
  image_url?: string | null;
  video_id?: string | null;
  recipe_title?: string | null;
  /** 블로그 레시피 검색에서 저장한 글 링크 — video_id(유튜브)와 공존 가능 */
  recipe_url?: string | null;
}

/** 끼니 저장 직후 호출부가 await 없이(fire-and-forget) 부르는 백그라운드 영양 추정 — 절대
 * 실패나 지연이 끼니 등록/수정 자체에 영향을 주면 안 된다는 원칙이라, 이 함수 내부에서 일어나는
 * 어떤 에러도 바깥으로 던지지 않고 조용히 삼킨다(에이전트 서버가 꺼져 있어도 그냥 영양 정보만
 * 비어있게 되는 정도). main_menu + sides를 합쳐 하나의 메뉴 문자열로 추정 요청을 보낸다. */
async function estimateAndSaveMealNutrition(mealId: string, mainMenu: string, sides: string[]) {
  try {
    const menuName = [mainMenu, ...sides].filter(Boolean).join(", ");
    const estimate = await callAgentServer<MealNutritionEstimate>("/estimate-nutrition", {
      menu_name: menuName,
    });
    if (estimate.kcal_min == null || estimate.kcal_max == null) return;

    const supabase = await createClient();
    const { error } = await supabase
      .from("meal")
      .update({
        kcal_min: estimate.kcal_min,
        kcal_max: estimate.kcal_max,
        macro_carb: estimate.macro_carb,
        macro_protein: estimate.macro_protein,
        macro_fat: estimate.macro_fat,
        nutrition_source: "estimate",
      })
      .eq("id", mealId);
    if (error) return;

    revalidatePath("/food");
    revalidatePath(`/food/${mealId}`);
    revalidatePath("/home");
  } catch {
    // 영양 정보는 부가 정보 — 실패를 사용자에게 알릴 필요 없음
  }
}

export async function createMeal(workspaceId: string, input: MealInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("meal")
    .insert({
      workspace_id: workspaceId,
      date: input.date,
      tag: input.tag,
      type: input.type,
      main_menu: input.main_menu,
      sides: input.sides,
      place: input.place ?? null,
      reservation_time: input.reservation_time ?? null,
      memo: input.memo ?? null,
      emoji: input.emoji ?? "🍽",
      image_url: input.image_url ?? null,
      video_id: input.video_id ?? null,
      recipe_title: input.recipe_title ?? null,
      recipe_url: input.recipe_url ?? null,
      author_id: user!.id,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "끼니 등록에 실패했습니다.");

  // await하지 않는다 — 영양 추정이 느리거나 실패해도 끼니 등록 자체는 이미 끝난 뒤라 영향 없음.
  void estimateAndSaveMealNutrition(data.id, input.main_menu, input.sides);

  revalidatePath("/food");
  revalidatePath("/home");
  redirect(`/food?date=${input.date}`);
}

export async function updateMeal(mealId: string, input: MealInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meal, error: fetchError } = await supabase
    .from("meal")
    .select("author_id")
    .eq("id", mealId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!meal || meal.author_id !== user.id) {
    return { ok: false as const, message: "수정 권한이 없습니다." };
  }

  const { error } = await supabase
    .from("meal")
    .update({
      date: input.date,
      tag: input.tag,
      type: input.type,
      main_menu: input.main_menu,
      sides: input.sides,
      place: input.place ?? null,
      reservation_time: input.reservation_time ?? null,
      memo: input.memo ?? null,
      image_url: input.image_url ?? null,
      video_id: input.video_id ?? null,
      recipe_title: input.recipe_title ?? null,
      recipe_url: input.recipe_url ?? null,
    })
    .eq("id", mealId);

  if (error) throw new Error(error.message);

  // 등록과 동일하게 await하지 않음 — 메뉴가 바뀌었을 수 있으니 수정 시에도 다시 추정한다.
  void estimateAndSaveMealNutrition(mealId, input.main_menu, input.sides);

  revalidatePath("/food");
  revalidatePath(`/food/${mealId}`);
  redirect(`/food/${mealId}`);
}

export async function deleteMeal(mealId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: meal, error: fetchError } = await supabase
    .from("meal")
    .select("author_id")
    .eq("id", mealId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!meal || meal.author_id !== user.id) {
    return { ok: false as const, message: "삭제 권한이 없습니다." };
  }

  const { error } = await supabase.from("meal").delete().eq("id", mealId);
  if (error) throw new Error(error.message);

  revalidatePath("/food");
  return { ok: true as const };
}

export async function addFridgeItem(
  workspaceId: string,
  name: string,
  category: FridgeCategory
) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("fridge_item")
    .insert({ workspace_id: workspaceId, name: trimmed, category, added_by: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/food/add");
}

export async function deleteFridgeItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fridge_item").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/food/add");
}

/** "늘 먹던 메뉴" 콜드스타트 판정용 — 서로 다른 날짜 기준 끼니 기록 일수를 센다.
 * meal.date에 유니크 인덱스가 없어 count distinct를 SQL로 직접 못 미뤄서, date 컬럼만
 * 가져와 앱 코드에서 Set으로 중복 제거한다(기록이 많아져도 date는 짧은 문자열이라 부담 적음). */
export async function getMealTrackingDayCount(workspaceId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal")
    .select("date")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  return new Set((data ?? []).map((m) => m.date)).size;
}

/** "자주 찾는 메뉴" 마퀴용 — 워크스페이스 전체 meal 기록에서 메뉴명(콤마로 여러 개면 토큰
 * 단위) 기준 등장 횟수를 집계해 상위 `limit`개를 빈도순으로 반환한다. `getFrequentMenus`
 * (mealUtils.ts)는 최근 200건 샘플로만 계산하는 가벼운 버전이라 이 위젯처럼 "그동안 등록된
 * 메뉴 전체" 기준이 필요할 땐 대신 이 서버 액션을 쓴다. */
export async function getTopFrequentMenus(workspaceId: string, limit = 20): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal")
    .select("main_menu")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { main_menu: string }[]) {
    for (const menu of row.main_menu.split(",").map((s: string) => s.trim()).filter(Boolean)) {
      counts.set(menu, (counts.get(menu) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([menu]) => menu);
}

export async function createMealVote(workspaceId: string, date: string, candidates: string[]) {
  const trimmed = candidates.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length < 2) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("meal_vote").insert({
    workspace_id: workspaceId,
    date,
    candidates: trimmed,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/food");
}

export async function castMealVoteBallot(voteId: string, candidateIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("meal_vote_ballot")
    .upsert(
      { vote_id: voteId, user_id: user.id, candidate_index: candidateIndex },
      { onConflict: "vote_id,user_id" }
    );

  if (error) throw new Error(error.message);

  revalidatePath("/home");
}

/** 마감 시각을 정해두고 자동으로 닫는 백그라운드 잡이 없어, 가족 중 누구나 이 액션으로
 * 수동 마감하면 그 시점의 최다득표 메뉴를 등록 제안 카드로 보여주는 방식으로 대체한다. */
export async function closeMealVote(voteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_vote").update({ is_closed: true }).eq("id", voteId);
  if (error) throw new Error(error.message);
  revalidatePath("/home");
}

export async function deleteMealVote(voteId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("meal_vote").delete().eq("id", voteId);
  if (error) throw new Error(error.message);
  revalidatePath("/home");
}

export async function addMealComment(mealId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("meal_comment")
    .insert({ meal_id: mealId, user_id: user.id, content: trimmed });

  if (error) throw new Error(error.message);

  revalidatePath("/food");
}
