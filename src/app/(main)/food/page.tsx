import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { requireWorkspaceContext } from "@/lib/workspace";
import { getWeekDates, toDateStr } from "@/lib/date";
import { mapWorkspaceMembers } from "@/lib/members";
import { WeekCalendar } from "@/components/food/WeekCalendar";
import { MealCard, type MealCardParticipant } from "@/components/food/MealCard";

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const selectedDate = date ?? toDateStr(new Date());
  const weekDates = getWeekDates(new Date(selectedDate));

  const [{ data: memberRows }, { data: weekMeals }, { data: dayMeals }] = await Promise.all([
    supabase
      .from("workspace_member")
      .select("user_id, display_name, users(avatar_color, avatar_text_color, avatar_image_url)")
      .eq("workspace_id", workspaceId),
    supabase
      .from("meal")
      .select("date")
      .eq("workspace_id", workspaceId)
      .gte("date", weekDates[0])
      .lte("date", weekDates[6]),
    supabase
      .from("meal")
      .select("*, meal_participation(user_id, status), meal_like(user_id)")
      .eq("workspace_id", workspaceId)
      .eq("date", selectedDate)
      .order("created_at", { ascending: true }),
  ]);

  const members = mapWorkspaceMembers(memberRows ?? []);

  const datesWithMeals = new Set((weekMeals ?? []).map((m) => m.date));

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-6">
      <WeekCalendar
        weekDates={weekDates}
        selectedDate={selectedDate}
        datesWithMeals={datesWithMeals}
      />

      <div className="flex flex-col gap-3">
        {(dayMeals ?? []).length === 0 && (
          <p className="py-8 text-center text-[13px] text-stone">
            등록된 끼니가 없어요
          </p>
        )}
        {(dayMeals ?? []).map((meal) => {
          const participation = (
            meal.meal_participation as { user_id: string; status: boolean | null }[]
          ) ?? [];
          const likes = (meal.meal_like as { user_id: string }[]) ?? [];

          const participants: MealCardParticipant[] = participation
            .filter((p) => p.status === true)
            .map((p) => {
              const m = members.find((mm) => mm.user_id === p.user_id);
              return {
                user_id: p.user_id,
                display_name: m?.display_name ?? "가족",
                avatar_color: m?.avatar_color ?? "#E1F5EE",
                avatar_text_color: m?.avatar_text_color ?? "#0F6E56",
                avatar_image_url: m?.avatar_image_url ?? null,
              };
            });

          const myParticipation =
            participation.find((p) => p.user_id === user.id)?.status ?? null;
          const liked = likes.some((l) => l.user_id === user.id);

          return (
            <MealCard
              key={meal.id}
              meal={meal}
              participants={participants}
              liked={liked}
              myParticipation={myParticipation}
            />
          );
        })}
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
