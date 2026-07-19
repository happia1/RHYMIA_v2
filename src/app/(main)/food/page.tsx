import Link from "next/link";
import { requireWorkspaceContext, getNutritionDisplayEnabled } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { getFrequentMenus } from "@/lib/mealUtils";
import { getWorkspaceMembers } from "@/lib/members.server";
import { getMealTrackingDayCount, getRecipeNotes } from "@/app/(main)/food/actions";
import { getShoppingItems } from "@/app/(main)/shopping/actions";
import { isFoodSafetyRecipeEnabled, getDailyRecommendedRecipe } from "@/lib/foodSafetyRecipe";
import { WeekCalendar } from "@/components/food/WeekCalendar";
import { MealEmptyState } from "@/components/food/MealEmptyState";
import { MealVoteCard } from "@/components/food/MealVoteCard";
import { SuggestionSection } from "@/components/food/SuggestionSection";
import { FoodTabActions } from "@/components/food/FoodTabActions";
import { MealListSection, type MealRow } from "@/components/food/MealListSection";
import { MealNutritionSummary } from "@/components/food/MealNutritionSummary";
import { FoodTabletHome } from "@/components/food/FoodTabletHome";
import { DeviceLayoutSwitch } from "@/components/ui/DeviceLayoutSwitch";
import { TabPageFrame } from "@/components/ui/TabPageFrame";
import { ScrollRegion } from "@/components/ui/ScrollRegion";
import type { FridgeItem } from "@/types";

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const selectedDate = date ?? toDateStr(new Date());
  const weekDates = getWeekDates(new Date(selectedDate));
  const recipeEnabled = isFoodSafetyRecipeEnabled();

  const [
    members,
    { data: weekMeals },
    { data: dayMeals },
    { data: mealHistory },
    { data: voteRows },
    { data: fridgeItems },
    trackingDays,
    nutritionEnabled,
    recommendedRecipe,
    recipeNotes,
    cartItems,
  ] = await Promise.all([
    getWorkspaceMembers(workspaceId),
    supabase
      .from("meal")
      .select("date")
      .eq("workspace_id", workspaceId)
      .gte("date", weekDates[0])
      .lte("date", weekDates[6]),
    supabase
      .from("meal")
      .select("*, meal_participation(user_id, status)")
      .eq("workspace_id", workspaceId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
    // 오늘의 제안 카드("늘 먹던 메뉴")·룰렛 후보 풀에 쓰는 최근 200건 빈도 집계용(getFrequentMenus).
    supabase
      .from("meal")
      .select("main_menu, date")
      .eq("workspace_id", workspaceId)
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("meal_vote")
      .select("*, meal_vote_ballot(*)")
      .eq("workspace_id", workspaceId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("fridge_item")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    getMealTrackingDayCount(workspaceId),
    getNutritionDisplayEnabled(workspaceId),
    // "매일 바뀌는" 추천이라 오늘의 실제 날짜로 시드 — WeekCalendar로 다른 날짜를 보고
    // 있어도 배너 자체는 항상 "오늘의" 추천을 보여준다("오늘 메뉴로 추가"는 selectedDate로).
    // 실패해도(공공 API 일시 장애 등) 이 배너 하나만 "불러오지 못했어요"로 빠지고 나머지
    // 식탁 탭 전체에는 영향 없게 catch로 감싼다.
    recipeEnabled
      ? getDailyRecommendedRecipe(toDateStr(new Date())).catch(() => null)
      : Promise.resolve(null),
    // recipe_note 테이블(supabase/add_recipe_note.sql)이 아직 라이브 DB에 없으면
    // "relation does not exist" 에러로 throw하는데(getRecipeNotes 자체는 의도적으로
    // throw — 즐겨찾기 토글 등에서는 실패를 명확히 알아야 함), 이 페이지 최초 로드에서까지
    // 그대로 던지면 식탁 탭 전체가 서버 에러로 죽는다. 위 recommendedRecipe와 같은 이유로
    // catch해 빈 목록으로 폴백.
    getRecipeNotes(workspaceId).catch(() => ({ favorites: [], recent: [] })),
    getShoppingItems(workspaceId),
  ]);

  const datesWithMeals = new Set((weekMeals ?? []).map((m) => m.date));
  const frequentMenus = getFrequentMenus(mealHistory ?? []);
  const todayVote = voteRows?.[0] ?? null;
  // 진행 중인 투표가 있으면 같은 날짜에 새 투표를 또 만들 수 없게 막는 용도 (결과 카드는 마감 여부와 무관하게 표시)
  const blockingVote = todayVote && !todayVote.is_closed ? todayVote : null;

  return (
    <TabPageFrame className="gap-4 px-4 pt-6">
      <DeviceLayoutSwitch
        mobile={
          <>
            <div className="shrink-0">
              <WeekCalendar
                weekDates={weekDates}
                selectedDate={selectedDate}
                datesWithMeals={datesWithMeals}
              />
            </div>

            <ScrollRegion className="flex flex-col gap-4 pb-6">
              {todayVote && (
                <MealVoteCard vote={todayVote} workspaceId={workspaceId} currentUserId={user.id} />
              )}

              {(dayMeals ?? []).length === 0 ? (
                <MealEmptyState
                  workspaceId={workspaceId}
                  selectedDate={selectedDate}
                  frequentMenus={frequentMenus}
                  activeVote={blockingVote}
                />
              ) : (
                <>
                  <MealListSection
                    meals={(dayMeals ?? []) as MealRow[]}
                    members={members}
                    currentUserId={user.id}
                    nutritionEnabled={nutritionEnabled}
                  />
                  <div className="flex items-center gap-2 border-t border-border-light pt-2.5">
                    {nutritionEnabled && (
                      <MealNutritionSummary meals={(dayMeals ?? []) as MealRow[]} />
                    )}
                    <Link
                      href={`/food/add?date=${selectedDate}`}
                      className="ml-auto shrink-0 text-[16px] font-medium text-honey"
                    >
                      + 끼니 추가
                    </Link>
                  </div>
                </>
              )}

              <div className="h-px w-full shrink-0 bg-border-light" />

              <FoodTabActions
                workspaceId={workspaceId}
                fridgeItems={(fridgeItems as FridgeItem[]) ?? []}
              />

              <div className="h-px w-full shrink-0 bg-border-light" />

              <SuggestionSection
                workspaceId={workspaceId}
                selectedDate={selectedDate}
                frequentMenus={frequentMenus}
                trackingDays={trackingDays}
                activeVote={blockingVote}
                recommendedRecipe={recommendedRecipe}
                recipeEnabled={recipeEnabled}
              />
            </ScrollRegion>
          </>
        }
        tablet={
          <div className="min-h-0 flex-1">
            <FoodTabletHome
              workspaceId={workspaceId}
              selectedDate={selectedDate}
              weekDates={weekDates}
              datesWithMeals={datesWithMeals}
              dayMeals={(dayMeals ?? []) as MealRow[]}
              members={members}
              currentUserId={user.id}
              nutritionEnabled={nutritionEnabled}
              frequentMenus={frequentMenus}
              trackingDays={trackingDays}
              blockingVote={blockingVote}
              recommendedRecipe={recommendedRecipe}
              recipeEnabled={recipeEnabled}
              recipeNotesCount={recipeNotes.favorites.length}
              fridgeItems={(fridgeItems as FridgeItem[]) ?? []}
              cartItems={cartItems}
            />
          </div>
        }
      />
    </TabPageFrame>
  );
}
