import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { tagOrderIndex } from "@/lib/mealUtils";
import {
  getCurrentBlock,
  getCarriedOvernightBlock,
  STATUS_EMOJI,
  DEFAULT_STATUS_EMOJI,
} from "@/lib/routineUtils";
import { getCurrentWeather } from "@/lib/weather";
import { getWorkspaceMembers } from "@/lib/members.server";
import { getOverdueTodos } from "@/app/(main)/schedule/actions";
import { listHomePhotos } from "@/lib/homePhotos.server";
import { mirror } from "@/lib/homeTheme";
import { resolveHomeLayout } from "@/lib/homeLayout";
import { HomeHeader, type FamilyMemberStatus } from "@/components/home/HomeHeader";
import { type MealSummaryItem } from "@/components/home/MealSummaryCard";
import { HomeMealSection } from "@/components/home/HomeMealSection";
import { HomeTodaySection } from "@/components/home/HomeTodaySection";
import { HomeStickySection } from "@/components/home/HomeStickySection";
import { HomeShoppingSection } from "@/components/home/HomeShoppingSection";
import { HomeSections } from "@/components/home/HomeSections";
import { HomeTabletHome } from "@/components/home/HomeTabletHome";
import type { NoticeComment, RoutineBlock, Todo } from "@/types";

export default async function HomePage() {
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const today = new Date();
  const todayStr = toDateStr(today);
  const weekDates = getWeekDates(today);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const [
    members,
    weather,
    { data: schedules },
    { data: todayTodoRows },
    overdueTodos,
    { data: meals },
    { data: shoppingItems },
    { data: stickers },
    { data: pinnedMemoRows },
    { data: myUserRow },
    homePhotos,
  ] = await Promise.all([
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
    // "오늘 뭐하지"에 일정과 함께 나오는 오늘 마감 미완료 할 일 — 완료된 건 굳이 홈까지 안 보여줌
    supabase
      .from("todo")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("due_date", todayStr)
      .eq("is_done", false)
      .order("created_at", { ascending: true }),
    // 마감이 지났는데 아직 완료 안 한 할 일("지난 할 일") — 일정 탭 선택일 패널과 같은 순서로
    // 일정 → 오늘 할 일 다음에 이어서 보여준다.
    getOverdueTodos(workspaceId, todayStr),
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
    // 가족상태 아래 "공지" 배너 — 고정된(is_pinned) 메모 중 최근 고정 순 최대 6건을
    // 카드형 자동 플랩 배너(PinnedNoticeBanner)로 보여준다. 탭하면 그 자리에서 상세
    // 팝업(NoticeDetailSheet)을 여니 전체 컬럼이 필요하다.
    supabase
      .from("notice")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("type", "memo")
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("users").select("home_layout").eq("id", user.id).single(),
    // 태블릿 홈 중앙 포토 프레임용 — 모바일 레이아웃은 안 쓰지만, list() 자체가 가벼운
    // Storage 호출이라 뷰 종류를 가리지 않고 그냥 함께 조회한다(분기 복잡도 줄이기).
    listHomePhotos(workspaceId),
  ]);

  const homeSectionOrder = resolveHomeLayout(myUserRow?.home_layout);

  // 작성자/참여자 표시용(meal_participation.user_id, notice.created_by 등 실제 로그인 user 기준):
  // user_id로 키 — managed 멤버는 user_id가 없어 이 맵엔 절대 등장하지 않음(의도된 동작)
  const membersByUserId: Record<string, (typeof members)[number]> = Object.fromEntries(
    members.filter((m): m is typeof m & { user_id: string } => Boolean(m.user_id)).map((m) => [m.user_id, m])
  );

  const memberIds = members.map((m) => m.id);

  // 어제 요일도 함께 조회 — 새벽 시간대엔 전날 밤 시작해 자정을 넘겨 이어지는 overnight
  // 블록(예: 어제 21:00~오늘 07:30 "잠")이 "오늘 요일" 목록에는 없어서 놓치기 때문.
  const yesterdayDow = (today.getDay() + 6) % 7;
  const { data: routineRows } = await supabase
    .from("routine")
    .select("member_id, day_of_week, blocks")
    .in("member_id", memberIds.length ? memberIds : [""])
    .in("day_of_week", [today.getDay(), yesterdayDow]);

  // 고정 메모 상세 팝업(NoticeDetailSheet)이 댓글까지 게시판과 동일하게 보여주므로, 화면에
  // 노출되는 최대 2건에 한해서만 댓글도 함께 가져온다(전체 notice_comment를 다 가져올
  // 필요는 없음 — 게시판 탭의 commentsByNotice와 같은 패턴, 범위만 좁힌 것).
  const pinnedMemoIds = (pinnedMemoRows ?? []).map((n) => n.id);
  const { data: pinnedMemoCommentRows } = pinnedMemoIds.length
    ? await supabase
        .from("notice_comment")
        .select("*")
        .in("notice_id", pinnedMemoIds)
        .order("created_at", { ascending: true })
    : { data: [] as NoticeComment[] };

  const pinnedMemoComments: Record<string, NoticeComment[]> = {};
  for (const c of pinnedMemoCommentRows ?? []) {
    (pinnedMemoComments[c.notice_id] ??= []).push(c);
  }

  // 오늘 뭐먹지? — 오늘 등록된 끼니만 시간순으로 보여준다 (등록된 게 없으면 빈 상태).
  // 참여자는 카드에서 텍스트가 아니라 아바타로 표기하므로 이름뿐 아니라 아바타 색/이미지까지 넘긴다.
  const toParticipants = (meal: {
    meal_participation?: { user_id: string; status: boolean | null }[];
  }) =>
    (meal.meal_participation ?? [])
      .filter((p) => p.status === true)
      .map((p) => membersByUserId[p.user_id])
      .filter((m): m is (typeof members)[number] & { user_id: string } => Boolean(m?.user_id))
      .map((m) => ({
        user_id: m.user_id,
        display_name: m.display_name,
        avatar_color: m.avatar_color,
        avatar_text_color: m.avatar_text_color,
        avatar_image_url: m.avatar_image_url,
      }));

  const mealsToShow: MealSummaryItem[] = (meals ?? [])
    .sort((a, b) => tagOrderIndex(a.tag) - tagOrderIndex(b.tag))
    .map((m) => ({ ...m, participants: toParticipants(m) }));

  // 오늘 뭐하지?
  const todaySchedules = (schedules ?? []).filter((s) => s.date_start === todayStr);

  // 지금 우리 가족은
  const routineByMember: Record<string, RoutineBlock[]> = {};
  const yesterdayRoutineByMember: Record<string, RoutineBlock[]> = {};
  for (const r of routineRows ?? []) {
    const target = r.day_of_week === today.getDay() ? routineByMember : yesterdayRoutineByMember;
    target[r.member_id as string] = (r.blocks as RoutineBlock[]) ?? [];
  }

  // 지금 우리 가족은 — 루틴 기반 상태만 표시 (일정 병기는 "오늘 뭐하지" 섹션 전담, 중복 제거)
  // managed 멤버(자녀 등)도 동일하게 루틴 기반 상태를 보여준다. 다른 account 멤버의 루틴은
  // RLS(can_read_routine)가 자기 자신 것만 허용하므로 routineByMember에 아예 없을 수 있고,
  // 그 경우 기본 상태("쉬는 중")로 표시된다 — 의도된 프라이버시 동작.
  // 오늘 요일 블록에서 못 찾으면(새벽 시간대 등) 어제 요일의 overnight 블록이 지금까지
  // 이어지고 있는지 한 번 더 확인한다.
  const familyStatus: FamilyMemberStatus[] = members.map((m) => {
    const block =
      getCurrentBlock(routineByMember[m.id] ?? [], today) ??
      getCarriedOvernightBlock(yesterdayRoutineByMember[m.id] ?? [], today);

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
    <HomeHeader
      familyStatus={familyStatus}
      weather={weather}
      nowIso={new Date().toISOString()}
      pinnedMemos={pinnedMemoRows ?? []}
      workspaceId={workspaceId}
      currentUserId={user.id}
      membersById={membersByUserId}
      commentsByNotice={pinnedMemoComments}
    />
  );

  // 홈 위젯 4개 — 2026-07-11부터 각각 독립 단위(예전엔 끼니+오늘/하고싶은말+장바구니 2개로 묶여있었음)
  const mealTodaySection = (
    <HomeMealSection meals={mealsToShow} defaultDate={todayStr} />
  );
  const scheduleTodaySection = (
    <HomeTodaySection
      todaySchedules={todaySchedules}
      todayTodos={(todayTodoRows ?? []) as Todo[]}
      overdueTodos={overdueTodos}
      members={memberOptions}
      workspaceId={workspaceId}
      defaultDate={todayStr}
      currentUserId={user.id}
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

      {/* 태블릿(1024px~): 가로/세로 전용 레이아웃 — fridge_tablet_suite.jsx 스펙,
          CSS orientation 미디어 쿼리로 실제 화면 방향에 맞는 쪽만 렌더된다. */}
      <div className="hidden h-full lg:block">
        <HomeTabletHome
          familyStatus={familyStatus}
          weather={weather}
          nowIso={new Date().toISOString()}
          pinnedMemos={pinnedMemoRows ?? []}
          stickers={stickers ?? []}
          workspaceId={workspaceId}
          currentUserId={user.id}
          membersById={membersByUserId}
          commentsByNotice={pinnedMemoComments}
          mealTodaySection={mealTodaySection}
          scheduleTodaySection={scheduleTodaySection}
          photoUrls={homePhotos.map((p) => p.url)}
        />
      </div>
    </div>
  );
}
