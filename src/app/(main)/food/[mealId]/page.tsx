import { notFound } from "next/navigation";
import { requireWorkspaceContext } from "@/lib/workspace";
import { mapWorkspaceMembers } from "@/lib/members";
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
        "*, meal_participation(user_id, status), meal_comment(id, user_id, content, created_at)"
      )
      .eq("id", mealId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("workspace_member")
      .select(
        "id, user_id, member_type, display_name, name, avatar_color, avatar_image_url, birth_year, users(avatar_color, avatar_text_color, avatar_image_url)"
      )
      .eq("workspace_id", workspaceId),
  ]);

  if (!meal) notFound();

  // 끼니 작성자/참여자/댓글은 전부 실제 로그인 user_id 기준이라 managed 멤버는 대상이 될 수 없음
  const members = mapWorkspaceMembers(memberRows ?? []).filter(
    (m): m is typeof m & { user_id: string } => Boolean(m.user_id)
  );

  const participation =
    (meal as unknown as {
      meal_participation: { user_id: string; status: boolean | null }[];
    }).meal_participation ?? [];
  const comments =
    (meal as unknown as { meal_comment: MealComment[] }).meal_comment ?? [];

  return (
    <MealDetail
      meal={meal as Meal}
      members={members}
      participation={participation}
      comments={comments.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )}
      currentUserId={user.id}
    />
  );
}
