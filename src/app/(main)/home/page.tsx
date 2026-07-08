import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { findUpcomingMeal, tagOrderIndex } from "@/lib/mealUtils";
import { getCurrentBlock, STATUS_EMOJI, DEFAULT_STATUS_EMOJI } from "@/lib/routineUtils";
import { getCurrentWeather } from "@/lib/weather";
import { mapWorkspaceMembers } from "@/lib/members";
import { mirror } from "@/lib/homeTheme";
import { resolveHomeLayout } from "@/lib/homeLayout";
import { HomeHeader, type FamilyMemberStatus } from "@/components/home/HomeHeader";
import { type MealSummaryItem } from "@/components/home/MealSummaryCard";
import { type MemberInfo } from "@/components/home/TodayEvents";
import { HomeMealSection } from "@/components/home/HomeMealSection";
import { HomeTodaySection } from "@/components/home/HomeTodaySection";
import { BoardPreview } from "@/components/home/BoardPreview";
import { HomeSections } from "@/components/home/HomeSections";
import type { RoutineBlock } from "@/types";

export default async function HomePage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const today = new Date();
  const todayStr = toDateStr(today);
  const weekDates = getWeekDates(today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const [{ data: memberRows }, weather, { data: schedules }, { data: meals }, { data: shoppingItems }, { data: stickers }, { data: myUserRow }] =
    await Promise.all([
      supabase
        .from("workspace_member")
        .select("user_id, display_name, users(avatar_color, avatar_text_color, avatar_image_url)")
        .eq("workspace_id", workspaceId),
      getCurrentWeather(),
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
      supabase.from("users").select("home_layout").eq("id", user.id).single(),
    ]);

  const homeSectionOrder = resolveHomeLayout(myUserRow?.home_layout);

  const members = mapWorkspaceMembers(memberRows ?? []);

  const membersById: Record<string, MemberInfo> = Object.fromEntries(
    members.map((m) => [m.user_id, { display_name: m.display_name, avatar_color: m.avatar_color }])
  );
  const membersByIdFull = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const memberIds = members.map((m) => m.user_id);

  const { data: routineRows } = await supabase
    .from("routine")
    .select("user_id, blocks")
    .in("user_id", memberIds.length ? memberIds : [""])
    .eq("day_of_week", today.getDay());

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

  // 지금 우리 가족은 — 루틴 기반 상태만 표시 (일정 병기는 "오늘 뭐하지" 섹션 전담, 중복 제거)
  const familyStatus: FamilyMemberStatus[] = members.map((m) => {
    const block = getCurrentBlock(routineByUser[m.user_id] ?? [], today);

    let statusText = "쉬는 중";
    let emoji = DEFAULT_STATUS_EMOJI;

    if (block) {
      statusText = block.label;
      emoji = STATUS_EMOJI[block.status] ?? DEFAULT_STATUS_EMOJI;
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

  const memberOptions = members.map((m) => ({
    user_id: m.user_id,
    display_name: m.display_name,
  }));

  const headerNode = (
    <HomeHeader familyStatus={familyStatus} weather={weather} nowIso={new Date().toISOString()} />
  );

  // 홈 위젯 순서 변경 단위 ①: "오늘 뭐먹지"+"오늘 뭐하지"를 2단으로 묶은 하나의 섹션
  const mealTodaySection = (
    <div className="grid grid-cols-2 gap-4">
      <HomeMealSection meals={mealsToShow} workspaceId={workspaceId} defaultDate={todayStr} />
      <div className={`border-l pl-4 ${mirror.hairline}`}>
        <HomeTodaySection
          todaySchedules={todaySchedules}
          membersById={membersById}
          members={memberOptions}
          workspaceId={workspaceId}
          defaultDate={todayStr}
        />
      </div>
    </div>
  );

  const boardSection = (
    <BoardPreview
      workspaceId={workspaceId}
      stickers={stickers ?? []}
      shoppingItems={shoppingItems ?? []}
      membersById={membersByIdFull}
    />
  );

  return (
    <div className={`min-h-screen ${mirror.bg} px-4 pb-24 pt-6`}>
      {/* 모바일: 위젯처럼 길게 눌러 순서를 바꿀 수 있는 2개 섹션(끼니+오늘/게시판) */}
      <div className="flex flex-col gap-section lg:hidden">
        {headerNode}
        <div className={`h-px w-full ${mirror.hairlineBg}`} />
        <HomeSections
          initialOrder={homeSectionOrder}
          sections={{ meal: mealTodaySection, board: boardSection }}
        />
      </div>

      {/* 태블릿 이상: 고정 3단 쇼케이스 레이아웃 (순서 변경 대상 아님) */}
      <div className="hidden lg:grid lg:grid-cols-mirror lg:items-stretch lg:gap-0">
        <div className="flex flex-col justify-center lg:pr-8">{headerNode}</div>

        <div className={`flex flex-col gap-section lg:border-l lg:px-8 ${mirror.hairline}`}>
          {mealTodaySection}
        </div>

        <div className={`flex flex-col lg:border-l lg:pl-8 ${mirror.hairline}`}>
          {boardSection}
        </div>
      </div>
    </div>
  );
}
