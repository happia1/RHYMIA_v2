import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { getFrequentMenus } from "@/lib/mealUtils";
import { mapWorkspaceMembers } from "@/lib/members";
import { getMealTrackingDayCount } from "@/app/(main)/food/actions";
import { WeekCalendar } from "@/components/food/WeekCalendar";
import { MealEmptyState } from "@/components/food/MealEmptyState";
import { MealVoteCard } from "@/components/food/MealVoteCard";
import { SuggestionSection } from "@/components/food/SuggestionSection";
import { FoodTabActions } from "@/components/food/FoodTabActions";
import { MealListSection, type MealRow } from "@/components/food/MealListSection";
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

  const [
    { data: memberRows },
    { data: weekMeals },
    { data: dayMeals },
    { data: mealHistory },
    { data: voteRows },
    { data: fridgeItems },
    trackingDays,
  ] = await Promise.all([
    supabase
      .from("workspace_member")
      .select(
        "id, user_id, member_type, display_name, name, avatar_color, avatar_image_url, birth_year, users(avatar_color, avatar_text_color, avatar_image_url)"
      )
      .eq("workspace_id", workspaceId),
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
  ]);

  const members = mapWorkspaceMembers(memberRows ?? []);

  const datesWithMeals = new Set((weekMeals ?? []).map((m) => m.date));
  const frequentMenus = getFrequentMenus(mealHistory ?? []);
  const todayVote = voteRows?.[0] ?? null;
  // 진행 중인 투표가 있으면 같은 날짜에 새 투표를 또 만들 수 없게 막는 용도 (결과 카드는 마감 여부와 무관하게 표시)
  const blockingVote = todayVote && !todayVote.is_closed ? todayVote : null;

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col gap-4 overflow-hidden px-4 pt-6">
      <div className="shrink-0">
        <WeekCalendar
          weekDates={weekDates}
          selectedDate={selectedDate}
          datesWithMeals={datesWithMeals}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-6">
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
          <MealListSection
            meals={(dayMeals ?? []) as MealRow[]}
            members={members}
            currentUserId={user.id}
          />
        )}

        <div className="h-px w-full shrink-0 bg-border-light" />

        <SuggestionSection
          workspaceId={workspaceId}
          selectedDate={selectedDate}
          frequentMenus={frequentMenus}
          trackingDays={trackingDays}
          activeVote={blockingVote}
        />

        <FoodTabActions workspaceId={workspaceId} fridgeItems={(fridgeItems as FridgeItem[]) ?? []} />
      </div>

      <Link
        href={`/food/add?date=${selectedDate}`}
        className="fixed bottom-[84px] right-6 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream"
        aria-label="끼니 추가"
      >
        <IconPlus size={26} />
      </Link>
    </div>
  );
}
