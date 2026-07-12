import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** layout.tsx와 각 탭 page.tsx가 요청마다 각자 호출하던 것을 React cache()로 감싸 같은
 * 요청 안에서는 한 번만 실행되게 한다(getUser() 인증 서버 왕복 + workspace_member 조회 중복 제거).
 * 요청이 끝나면 캐시가 초기화되므로 스테일 데이터 위험은 없음. */
export const requireWorkspaceContext = cache(async function requireWorkspaceContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_member")
    .select("workspace_id, role, display_name")
    .eq("user_id", user!.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/workspace");

  return {
    supabase,
    user: user!,
    workspaceId: membership!.workspace_id as string,
    role: membership!.role as string,
    displayName: membership!.display_name as string | null,
  };
});

/** 끼니 영양 정보(추정) 표시 여부 — 워크스페이스 단위, 기본 켜짐(컬럼 자체 기본값과 동일).
 * 같은 요청 안에서 여러 곳(식탁 탭 목록/상세)이 부를 수 있어 cache()로 중복 조회를 막는다. */
export const getNutritionDisplayEnabled = cache(async function getNutritionDisplayEnabled(
  workspaceId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("family_workspace")
    .select("nutrition_display_enabled")
    .eq("id", workspaceId)
    .maybeSingle();
  return data?.nutrition_display_enabled ?? true;
});
