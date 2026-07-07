import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { findUpcomingMeal, tagOrderIndex } from "@/lib/mealUtils";
import { getCurrentBlock, STATUS_EMOJI, DEFAULT_STATUS_EMOJI } from "@/lib/routineUtils";
import { getCurrentWeather } from "@/lib/weather";
import { mapWorkspaceMembers } from "@/lib/members";
import { mirror } from "@/lib/homeTheme";
import { HomeHeader } from "@/components/home/HomeHeader";
import { MealSummaryCard, type MealSummaryItem } from "@/components/home/MealSummaryCard";
import { TodayEvents, type MemberInfo } from "@/components/home/TodayEvents";
import { FamilyStatusCard, type FamilyMemberStatus } from "@/components/home/FamilyStatusCard";
import { BoardPreview } from "@/components/home/BoardPreview";
import type { RoutineBlock } from "@/types";

export default async function HomePage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const today = new Date();
  const todayStr = toDateStr(today);
  const weekDates = getWeekDates(today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const { data: memberRows } = await supabase
    .from("workspace_member")
    .select("user_id, display_name, users(avatar_color, avatar_text_color, avatar_image_url)")
    .eq("workspace_id", workspaceId);

  const members = mapWorkspaceMembers(memberRows ?? []);

  const membersById: Record<string, MemberInfo> = Object.fromEntries(
    members.map((m) => [m.user_id, { display_name: m.display_name, avatar_color: m.avatar_color }])
  );
  const membersByIdFull = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const memberIds = members.map((m) => m.user_id);

  const [weather, { data: routineRows }, { data: schedules }, { data: meals }, { data: shoppingItems }, { data: stickers }] =
    await Promise.all([
      getCurrentWeather(),
      supabase
        .from("routine")
        .select("user_id, blocks")
        .in("user_id", memberIds.length ? memberIds : [""])
        .eq("day_of_week", today.getDay()),
      supabase
        .from("schedule")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("date_start", weekStart)
        .lte("date_start", weekEnd)
        .or(`is_shared.eq.true,author_id.eq.${user.id}`)
        .order("date_start", { ascending: true }),
      supabase
        .from("meal")
        .select("*, meal_participation(user_id, status)")
        .eq("workspace_id", workspaceId)
        .gte("date", todayStr)
        .order("date", { ascending: true })
        .limit(20),
      supabase
        .from("shopping_item")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("added_at", { ascending: false }),
      supabase
        .from("notice")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("type", "sticky")
        .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // 오늘 뭐먹지? — 오늘 등록된 끼니를 전부 시간순으로 보여주고,
  // 오늘 등록된 끼니가 없으면 가장 가까운 다음 끼니 하나로 대체한다.
  const toParticipantNames = (meal: {
    meal_participation?: { user_id: string; status: boolean | null }[];
  }): string[] =>
    (meal.meal_participation ?? [])
      .filter((p) => p.status === true)
      .map((p) => membersById[p.user_id]?.display_name)
      .filter((name): name is string => Boolean(name));

  const todayMeals = (meals ?? [])
    .filter((m) => m.date === todayStr)
    .sort((a, b) => tagOrderIndex(a.tag) - tagOrderIndex(b.tag));
  const upcomingFallback = todayMeals.length === 0 ? findUpcomingMeal(meals ?? [], today) : null;
  const mealsToShow: MealSummaryItem[] = (todayMeals.length > 0 ? todayMeals : [upcomingFallback].filter(Boolean))
    .filter((m): m is NonNullable<typeof m> => m !== null)
    .map((m) => ({ ...m, participantNames: toParticipantNames(m) }));

  // 오늘 뭐하지?
  const todaySchedules = (schedules ?? []).filter((s) => s.date_start === todayStr);

  // 지금 우리 가족은
  const routineByUser: Record<string, RoutineBlock[]> = {};
  for (const r of routineRows ?? []) {
    routineByUser[r.user_id as string] = (r.blocks as RoutineBlock[]) ?? [];
  }

  const familyStatus: FamilyMemberStatus[] = members.map((m) => {
    const block = getCurrentBlock(routineByUser[m.user_id] ?? [], today);
    const targetedSchedule = todaySchedules.find(
      (s) => s.target_members.length === 0 || s.target_members.includes(m.user_id)
    );

    let statusText = "쉬는 중";
    let emoji = DEFAULT_STATUS_EMOJI;

    if (block) {
      statusText = block.label;
      emoji = STATUS_EMOJI[block.status] ?? DEFAULT_STATUS_EMOJI;
    }

    if (targetedSchedule) {
      statusText = block
        ? `${statusText} · ${targetedSchedule.title}`
        : targetedSchedule.title;
    }

    return {
      user_id: m.user_id,
      display_name: m.display_name,
      avatar_color: m.avatar_color,
      avatar_text_color: m.avatar_text_color,
      avatar_image_url: m.avatar_image_url,
      emoji,
      statusText,
    };
  });

  const myStatus = familyStatus.find((f) => f.user_id === user.id);
  const otherFamilyStatus = familyStatus.filter((f) => f.user_id !== user.id);

  return (
    <div className={`min-h-screen ${mirror.bg} px-4 pb-24 pt-6`}>
      <div className="flex flex-col gap-section lg:grid lg:grid-cols-mirror lg:items-stretch lg:gap-0">
        <div className="flex flex-col justify-center lg:pr-8">
          <HomeHeader
            displayName={myStatus?.display_name ?? "가족"}
            avatarColor={myStatus?.avatar_color ?? "#E1F5EE"}
            avatarTextColor={myStatus?.avatar_text_color ?? "#0F6E56"}
            avatarImageUrl={myStatus?.avatar_image_url ?? null}
            statusText={myStatus?.statusText ?? "쉬는 중"}
            weather={weather}
            nowIso={new Date().toISOString()}
          />
        </div>

        <div className={`flex flex-col gap-section lg:border-l lg:px-8 ${mirror.hairline}`}>
          <section className="flex flex-col gap-label-gap">
            <span className={mirror.label}>오늘 뭐먹지</span>
            <MealSummaryCard meals={mealsToShow} />
          </section>

          <div className={`h-px w-full ${mirror.hairlineBg}`} />

          <section className="flex flex-col gap-label-gap">
            <span className={mirror.label}>오늘 뭐하지</span>
            <TodayEvents
              todaySchedules={todaySchedules}
              weekSchedules={schedules ?? []}
              weekDates={weekDates}
              membersById={membersById}
            />
          </section>

          <div className={`h-px w-full ${mirror.hairlineBg}`} />

          <section className="flex flex-col gap-label-gap">
            <span className={mirror.label}>지금 우리 가족은</span>
            <FamilyStatusCard members={otherFamilyStatus} />
          </section>
        </div>

        <div className={`h-px w-full ${mirror.hairlineBg} lg:hidden`} />

        <div className={`flex flex-col lg:border-l lg:pl-8 ${mirror.hairline}`}>
          <BoardPreview
            stickers={stickers ?? []}
            shoppingItems={shoppingItems ?? []}
            membersById={membersByIdFull}
          />
        </div>
      </div>
    </div>
  );
}
