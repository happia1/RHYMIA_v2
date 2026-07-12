import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { tagOrderIndex } from "@/lib/mealUtils";
import { getCurrentBlock, STATUS_EMOJI, DEFAULT_STATUS_EMOJI } from "@/lib/routineUtils";
import { getCurrentWeather } from "@/lib/weather";
import { getWorkspaceMembers } from "@/lib/members";
import { mirror } from "@/lib/homeTheme";
import { resolveHomeLayout } from "@/lib/homeLayout";
import { HomeHeader, type FamilyMemberStatus } from "@/components/home/HomeHeader";
import { type MealSummaryItem } from "@/components/home/MealSummaryCard";
import { HomeMealSection } from "@/components/home/HomeMealSection";
import { HomeTodaySection } from "@/components/home/HomeTodaySection";
import { HomeStickySection } from "@/components/home/HomeStickySection";
import { HomeShoppingSection } from "@/components/home/HomeShoppingSection";
import { HomeSections } from "@/components/home/HomeSections";
import type { RoutineBlock } from "@/types";

export default async function HomePage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const today = new Date();
  const todayStr = toDateStr(today);
  const weekDates = getWeekDates(today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const [members, weather, { data: schedules }, { data: meals }, { data: shoppingItems }, { data: stickers }, { data: myUserRow }] =
    await Promise.all([
      getWorkspaceMembers(workspaceId),
      getCurrentWeather(),
      supabase
        .from("schedule")
        .select("*")
        .eq("workspace_id", workspaceId)
        .gte("date_start", weekStart)
        .lte("date_start", weekEnd)
        .or(`is_shared.eq.true,author_id.eq.${user.id}`)
        .order("date_start", { ascending: true }),
      // 홈은 "오늘 등록된 것만" 보여주는 상태판 — 등록된 게 없으면 다른 날짜로 대체하지 않고 비워둔다
      supabase
        .from("meal")
        .select("*, meal_participation(user_id, status)")
        .eq("workspace_id", workspaceId)
        .eq("date", todayStr),
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

  // 작성자/참여자 표시용(meal_participation.user_id, notice.created_by 등 실제 로그인 user 기준):
  // user_id로 키 — managed 멤버는 user_id가 없어 이 맵엔 절대 등장하지 않음(의도된 동작)
  const membersByUserId: Record<string, (typeof members)[number]> = Object.fromEntries(
    members.filter((m): m is typeof m & { user_id: string } => Boolean(m.user_id)).map((m) => [m.user_id, m])
  );

  const memberIds = members.map((m) => m.id);

  const { data: routineRows } = await supabase
    .from("routine")
    .select("member_id, blocks")
    .in("member_id", memberIds.length ? memberIds : [""])
    .eq("day_of_week", today.getDay());

  // 오늘 뭐먹지? — 오늘 등록된 끼니만 시간순으로 보여준다 (등록된 게 없으면 빈 상태)
  const toParticipantNames = (meal: {
    meal_participation?: { user_id: string; status: boolean | null }[];
  }): string[] =>
    (meal.meal_participation ?? [])
      .filter((p) => p.status === true)
      .map((p) => membersByUserId[p.user_id]?.display_name)
      .filter((name): name is string => Boolean(name));

  const mealsToShow: MealSummaryItem[] = (meals ?? [])
    .sort((a, b) => tagOrderIndex(a.tag) - tagOrderIndex(b.tag))
    .map((m) => ({ ...m, participantNames: toParticipantNames(m) }));

  // 오늘 뭐하지?
  const todaySchedules = (schedules ?? []).filter((s) => s.date_start === todayStr);

  // 지금 우리 가족은
  const routineByMember: Record<string, RoutineBlock[]> = {};
  for (const r of routineRows ?? []) {
    routineByMember[r.member_id as string] = (r.blocks as RoutineBlock[]) ?? [];
  }

  // 지금 우리 가족은 — 루틴 기반 상태만 표시 (일정 병기는 "오늘 뭐하지" 섹션 전담, 중복 제거)
  // managed 멤버(자녀 등)도 동일하게 루틴 기반 상태를 보여준다. 다른 account 멤버의 루틴은
  // RLS(can_read_routine)가 자기 자신 것만 허용하므로 routineByMember에 아예 없을 수 있고,
  // 그 경우 기본 상태("쉬는 중")로 표시된다 — 의도된 프라이버시 동작.
  const familyStatus: FamilyMemberStatus[] = members.map((m) => {
    const block = getCurrentBlock(routineByMember[m.id] ?? [], today);

    let statusText = "쉬는 중";
    let emoji = DEFAULT_STATUS_EMOJI;

    if (block) {
      statusText = block.label;
      emoji = STATUS_EMOJI[block.status] ?? DEFAULT_STATUS_EMOJI;
    }

    return {
      id: m.id,
      display_name: m.display_name,
      avatar_color: m.avatar_color,
      avatar_text_color: m.avatar_text_color,
      avatar_image_url: m.avatar_image_url,
      emoji,
      statusText,
    };
  });

  const memberOptions = members.map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }));

  const headerNode = (
    <HomeHeader familyStatus={familyStatus} weather={weather} nowIso={new Date().toISOString()} />
  );

  // 홈 위젯 4개 — 2026-07-11부터 각각 독립 단위(예전엔 끼니+오늘/하고싶은말+장바구니 2개로 묶여있었음)
  const mealTodaySection = (
    <HomeMealSection meals={mealsToShow} workspaceId={workspaceId} defaultDate={todayStr} />
  );
  const scheduleTodaySection = (
    <HomeTodaySection
      todaySchedules={todaySchedules}
      members={memberOptions}
      workspaceId={workspaceId}
      defaultDate={todayStr}
    />
  );
  const stickySection = (
    <HomeStickySection
      workspaceId={workspaceId}
      currentUserId={user.id}
      stickers={stickers ?? []}
      membersById={membersByUserId}
    />
  );
  const shoppingSection = <HomeShoppingSection shoppingItems={shoppingItems ?? []} />;

  return (
    <div className={`flex h-[calc(100dvh-64px)] flex-col overflow-hidden ${mirror.bg} px-4 pt-6 pb-4`}>
      {/* 모바일: 위젯처럼 길게 눌러 순서를 바꿀 수 있는 4개 독립 섹션(끼니/오늘/하고싶은말/장바구니).
          한 화면(100dvh - 독바 높이)에 고정 — 헤더/헤어라인은 고정 높이, 위젯 그리드 영역만
          남은 높이를 차지하고 넘치면 그 영역 안에서만 스크롤(overflow-y-auto), 페이지 자체는 스크롤 없음. */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="shrink-0">{headerNode}</div>
        <div className={`my-3 h-px w-full shrink-0 ${mirror.hairlineBg}`} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HomeSections
            initialOrder={homeSectionOrder}
            sections={{
              mealToday: mealTodaySection,
              scheduleToday: scheduleTodaySection,
              sticky: stickySection,
              shopping: shoppingSection,
            }}
          />
        </div>
      </div>

      {/* 태블릿 이상: 고정 3단 쇼케이스 레이아웃 (순서 변경 대상 아님) */}
      <div className="hidden lg:grid lg:h-full lg:grid-cols-mirror lg:items-stretch lg:gap-0">
        <div className="flex flex-col justify-center lg:pr-8">{headerNode}</div>

        <div className={`flex flex-col gap-section lg:border-l lg:px-8 ${mirror.hairline}`}>
          <div className="grid grid-cols-2 gap-4">
            {mealTodaySection}
            {scheduleTodaySection}
          </div>
        </div>

        <div className={`flex flex-col lg:border-l lg:pl-8 ${mirror.hairline}`}>
          <div className="grid grid-cols-2 gap-4">
            {stickySection}
            {shoppingSection}
          </div>
        </div>
      </div>
    </div>
  );
}
