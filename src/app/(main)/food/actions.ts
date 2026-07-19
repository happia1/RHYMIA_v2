"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estimateMealNutrition } from "@/lib/nutritionEstimate";
import { toDateStr } from "@/lib/date";
import { addDaysToDateStr } from "@/lib/recurrence";
import type { NormalizedRecipe } from "@/lib/foodSafetyRecipe";
import type { FridgeCategory, Meal, MealType } from "@/types";

// 레시피 노트(즐겨찾기/최근 본 레시피) — 현재는 식품안전나라 내부 레시피만 지원.
const RECIPE_NOTE_SOURCE = "foodsafety";
// "최근 본 레시피"는 이 개수를 넘어가면 오래된 것부터 정리한다(즐겨찾기는 예외 — 안 지움).
const MAX_RECENT_RECIPES = 30;

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
  /** "집에 뭐 있지"에서 고른 재료명 스냅샷 */
  ingredients?: string[];
}

/** 끼니 저장 직후 호출부가 await 없이(fire-and-forget) 부르는 백그라운드 영양 추정 — 절대
 * 실패나 지연이 끼니 등록/수정 자체에 영향을 주면 안 된다는 원칙이라, 이 함수 내부에서 일어나는
 * 어떤 에러도 바깥으로 던지지 않고 조용히 삼킨다. 다만 "조용히"가 "로그도 안 남기고"를 뜻하진
 * 않는다 — 예전엔 에이전트 서버 호출 실패가 로그 없이 그냥 삼켜져서, 그 서버가 프로덕션에
 * 배포된 적이 없다는(→ 모든 끼니의 칼로리가 항상 비어 있던) 사실을 한동안 못 알아챘다
 * (estimateMealNutrition 쪽으로 이전한 사유는 nutritionEstimate.ts 참고). main_menu + sides를
 * 합쳐 하나의 메뉴 문자열로 추정한다. */
async function estimateAndSaveMealNutrition(mealId: string, mainMenu: string, sides: string[]) {
  try {
    const menuName = [mainMenu, ...sides].filter(Boolean).join(", ");
    const estimate = await estimateMealNutrition(menuName);
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
    if (error) {
      console.error("[estimateAndSaveMealNutrition] meal update failed:", error);
      return;
    }

    revalidatePath("/food");
    revalidatePath(`/food/${mealId}`);
    revalidatePath("/home");
  } catch (err) {
    console.error("[estimateAndSaveMealNutrition] failed:", err);
  }
}

/** 끼니 상세의 "영양 정보 다시 계산" 버튼 — kcal이 계속 비어 있는 기존 끼니들을 위한 1회
 * 재추정. estimateAndSaveMealNutrition과 달리 사용자가 직접 누른 동작이라 결과를 바로
 * 알려줘야 해서 예외를 삼키지 않고 { ok, message } 형태로 반환한다. */
export async function recalculateMealNutrition(
  mealId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data: meal, error: fetchError } = await supabase
    .from("meal")
    .select("main_menu, sides")
    .eq("id", mealId)
    .single();

  if (fetchError || !meal) {
    return { ok: false, message: "끼니 정보를 불러오지 못했어요." };
  }

  const menuName = [meal.main_menu, ...(meal.sides ?? [])].filter(Boolean).join(", ");
  const estimate = await estimateMealNutrition(menuName);
  if (estimate.kcal_min == null || estimate.kcal_max == null) {
    return { ok: false, message: "영양 정보를 추정하지 못했어요. 잠시 후 다시 시도해주세요." };
  }

  const { error: updateError } = await supabase
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

  if (updateError) {
    console.error("[recalculateMealNutrition] meal update failed:", updateError);
    return { ok: false, message: "저장에 실패했어요." };
  }

  revalidatePath("/food");
  revalidatePath(`/food/${mealId}`);
  revalidatePath("/home");
  return { ok: true };
}

/** 추천 레시피 상세("오늘 메뉴로 추가하기")/레시피(내부) 검색 결과에서 고른 완성 사진을
 * 우리 Storage로 복사한다 — 공공데이터(식품안전나라)라 재배포가 허용되고, 외부 도메인
 * URL을 meal.image_url에 그대로 저장하면 나중에 그쪽 서버 사정으로 깨질 수 있어서다.
 * 서버에서 직접 fetch하므로 브라우저 CORS 제약이 없다. */
export async function copyRecipeImageToStorage(
  imageUrl: string
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return { ok: false, message: "레시피 이미지를 불러오지 못했어요." };

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("meal-images")
      .upload(path, blob, { upsert: true, contentType });
    if (error) return { ok: false, message: "레시피 이미지 저장에 실패했어요." };

    const { data } = supabase.storage.from("meal-images").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch {
    return { ok: false, message: "레시피 이미지 저장에 실패했어요." };
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
      ingredients: input.ingredients ?? [],
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
      ingredients: input.ingredients ?? [],
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

  // 태블릿 식탁 탭도 냉장고 재고를 보여주므로(FoodTabletHome) 그쪽도 함께 무효화.
  revalidatePath("/food/add");
  revalidatePath("/food");
}

export async function deleteFridgeItem(itemId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fridge_item").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath("/food/add");
  revalidatePath("/food");
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

/** "끼니 추가"의 "최근 먹은 메뉴" 칩 목록용 — 최근 `days`일(오늘 포함)간 등록된 끼니를
 * 최신순으로 반환한다. 같은 메뉴(main_menu+sides 조합)를 그 기간에 여러 번 먹었으면 가장
 * 최근 것 하나만 남겨 중복 칩이 뜨지 않게 한다. */
export async function getRecentMeals(workspaceId: string, days = 3): Promise<Meal[]> {
  const supabase = await createClient();
  const since = addDaysToDateStr(toDateStr(new Date()), -(days - 1));

  const { data, error } = await supabase
    .from("meal")
    .select("*")
    .eq("workspace_id", workspaceId)
    .gte("date", since)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const result: Meal[] = [];
  for (const meal of (data ?? []) as Meal[]) {
    const key = [meal.main_menu, ...meal.sides].filter(Boolean).join(", ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(meal);
  }
  return result;
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

/** "레시피 찾아보기" 시트에서 검색어 없이 열었을 때 보여줄 "내 레시피 노트"(즐겨찾기)와
 * "최근 본 레시피" 목록. recipe_note.data에 스냅샷으로 저장해둔 NormalizedRecipe를
 * 그대로 돌려주므로 외부 API를 다시 호출하지 않는다. */
export async function getRecipeNotes(workspaceId: string): Promise<{
  favorites: NormalizedRecipe[];
  recent: NormalizedRecipe[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe_note")
    .select("data, is_favorite, last_viewed_at")
    .eq("workspace_id", workspaceId)
    .eq("source", RECIPE_NOTE_SOURCE)
    .order("last_viewed_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    data: NormalizedRecipe;
    is_favorite: boolean;
    last_viewed_at: string | null;
  }[];

  return {
    favorites: rows.filter((r) => r.is_favorite).map((r) => r.data),
    recent: rows.filter((r) => r.last_viewed_at).map((r) => r.data),
  };
}

/** 레시피 카드의 별 토글 — 껐다 켰다 할 때마다 현재 상태를 조회해 반전시킨다(체크박스가
 * 아니라 하나의 액션으로 켜기/끄기를 겸함). 아직 recipe_note 행이 없던 레시피(검색 결과에서
 * 바로 즐겨찾기하는 경우)도 이 upsert 한 번으로 스냅샷과 함께 새로 생긴다. */
export async function toggleRecipeFavorite(
  workspaceId: string,
  recipe: NormalizedRecipe
): Promise<{ ok: true; isFavorite: boolean } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "로그인이 필요해요." };

  const { data: existing } = await supabase
    .from("recipe_note")
    .select("is_favorite")
    .eq("workspace_id", workspaceId)
    .eq("source", RECIPE_NOTE_SOURCE)
    .eq("external_id", recipe.id)
    .maybeSingle();

  const nextFavorite = !existing?.is_favorite;

  const { error } = await supabase.from("recipe_note").upsert(
    {
      workspace_id: workspaceId,
      source: RECIPE_NOTE_SOURCE,
      external_id: recipe.id,
      title: recipe.name,
      image_url: recipe.image,
      data: recipe,
      is_favorite: nextFavorite,
      created_by: user.id,
    },
    { onConflict: "workspace_id,source,external_id" }
  );

  if (error) return { ok: false, message: error.message };
  return { ok: true, isFavorite: nextFavorite };
}

/** 레시피 상세 시트를 열 때 호출 — "최근 본" 순서 갱신용으로 last_viewed_at만 갱신하고
 * is_favorite은 건드리지 않는다(upsert에 안 넣은 컬럼은 충돌 시에도 그대로 유지됨).
 * 실패해도 상세 화면 자체엔 영향이 없어야 하는 부가 기록이라 에러를 던지지 않는다. */
export async function recordRecipeViewed(workspaceId: string, recipe: NormalizedRecipe): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("recipe_note").upsert(
      {
        workspace_id: workspaceId,
        source: RECIPE_NOTE_SOURCE,
        external_id: recipe.id,
        title: recipe.name,
        image_url: recipe.image,
        data: recipe,
        last_viewed_at: new Date().toISOString(),
        created_by: user.id,
      },
      { onConflict: "workspace_id,source,external_id" }
    );
    if (error) return;

    // "최근 본"은 최대 MAX_RECENT_RECIPES건만 유지 — 즐겨찾기(is_favorite)는 대상에서 제외.
    const { data: viewedRows } = await supabase
      .from("recipe_note")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("source", RECIPE_NOTE_SOURCE)
      .eq("is_favorite", false)
      .not("last_viewed_at", "is", null)
      .order("last_viewed_at", { ascending: false })
      .limit(500);

    const staleIds = (viewedRows ?? []).slice(MAX_RECENT_RECIPES).map((r) => r.id as string);
    if (staleIds.length > 0) {
      await supabase.from("recipe_note").delete().in("id", staleIds);
    }
  } catch {
    // 조회 기록은 부가 기능 — 실패를 사용자에게 알릴 필요 없음
  }
}
