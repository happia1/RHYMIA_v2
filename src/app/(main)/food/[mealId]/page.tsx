import { notFound } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/workspace";
import { MealDetail } from "@/components/food/MealDetail";
import type { Meal, MealComment } from "@/types";

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ mealId: string }>;
}) {
  const { mealId } = await params;
  const { supabase, user, workspaceId } = await requireWorkspaceContext();

  const [{ data: meal }, { data: memberRows }] = await Promise.all([
    supabase
      .from("meal")
      .select(
        "*, meal_participation(user_id, status), meal_like(user_id), meal_comment(id, user_id, content, created_at)"
      )
      .eq("id", mealId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("workspace_member")
      .select("user_id, display_name, users(avatar_color, avatar_text_color)")
      .eq("workspace_id", workspaceId),
  ]);

  if (!meal) notFound();

  const members = (memberRows ?? []).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id as string,
      display_name: m.display_name ?? "가족",
      avatar_color: u?.avatar_color ?? "#E1F5EE",
      avatar_text_color: u?.avatar_text_color ?? "#0F6E56",
    };
  });

  const participation =
    (meal as unknown as {
      meal_participation: { user_id: string; status: boolean | null }[];
    }).meal_participation ?? [];
  const likes =
    (meal as unknown as { meal_like: { user_id: string }[] }).meal_like ?? [];
  const comments =
    (meal as unknown as { meal_comment: MealComment[] }).meal_comment ?? [];

  return (
    <MealDetail
      meal={meal as Meal}
      members={members}
      participation={participation}
      likedByMe={likes.some((l) => l.user_id === user.id)}
      comments={comments.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )}
      currentUserId={user.id}
    />
  );
}
