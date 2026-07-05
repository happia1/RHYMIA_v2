import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { findUpcomingMeal } from "@/lib/mealUtils";
import { getCurrentBlock, STATUS_EMOJI, DEFAULT_STATUS_EMOJI } from "@/lib/routineUtils";
import { MealSummaryCard, type MealSummaryParticipant } from "@/components/home/MealSummaryCard";
import { TodayEvents, type MemberInfo } from "@/components/home/TodayEvents";
import { FamilyStatusCard, type FamilyMemberStatus } from "@/components/home/FamilyStatusCard";
import { ShoppingList } from "@/components/home/ShoppingList";
import { BoardSection } from "@/components/home/BoardSection";
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
    .select("user_id, display_name, users(email, avatar_color, avatar_text_color)")
    .eq("workspace_id", workspaceId);

  const members = (memberRows ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id as string,
      display_name: m.display_name ?? "가족",
      avatar_color: u?.avatar_color ?? "#E1F5EE",
      avatar_text_color: u?.avatar_text_color ?? "#0F6E56",
    };
  });

  const membersById: Record<string, MemberInfo> = Object.fromEntries(
    members.map((m) => [m.user_id, { display_name: m.display_name, avatar_color: m.avatar_color }])
  );

  const memberIds = members.map((m) => m.user_id);

  const [{ data: routineRows }, { data: schedules }, { data: meals }, { data: shoppingItems }, { data: notices }] =
    await Promise.all([
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
        .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false }),
    ]);

  // 오늘 뭐먹지?
  const upcomingMeal = findUpcomingMeal(meals ?? [], today);
  const participants: MealSummaryParticipant[] = upcomingMeal
    ? ((upcomingMeal as unknown as { meal_participation: { user_id: string; status: boolean | null }[] })
        .meal_participation ?? [])
        .filter((p) => p.status === true)
        .map((p) => {
          const m = members.find((mm) => mm.user_id === p.user_id);
          return {
            user_id: p.user_id,
            display_name: m?.display_name ?? "가족",
            avatar_color: m?.avatar_color ?? "#E1F5EE",
            avatar_text_color: m?.avatar_text_color ?? "#0F6E56",
          };
        })
    : [];

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
      emoji,
      statusText,
    };
  });

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-6">
      <MealSummaryCard meal={upcomingMeal} participants={participants} />
      <TodayEvents
        todaySchedules={todaySchedules}
        weekSchedules={schedules ?? []}
        weekDates={weekDates}
        membersById={membersById}
      />
      <FamilyStatusCard members={familyStatus} />
      <ShoppingList workspaceId={workspaceId} items={shoppingItems ?? []} />
      <BoardSection workspaceId={workspaceId} notices={notices ?? []} currentUserId={user.id} />
    </div>
  );
}
