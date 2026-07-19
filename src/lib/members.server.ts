import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { mapWorkspaceMembers, type WorkspaceMemberInfo } from "@/lib/members";

const WORKSPACE_MEMBER_SELECT =
  "id, user_id, member_type, display_name, name, avatar_color, avatar_image_url, birth_year, routine_enabled, users(avatar_color, avatar_text_color, avatar_image_url)";

/** 홈/식탁/일정/게시판 4개 페이지가 거의 동일한 쿼리를 각자 실행하던 것을 공용 함수로 추출.
 * cache()로 감싸 같은 요청 안에서 중복 호출되면(다른 컴포넌트가 추가로 필요로 하거나,
 * Next.js가 같은 라우트를 prefetch로 여러 번 렌더하는 경우 등) 중복 조회를 피한다.
 * 요청이 끝나면 캐시가 초기화되므로 스테일 데이터 위험은 없음. 서버 컴포넌트 전용 —
 * 클라이언트는 `@/lib/members`의 타입/상수/mapWorkspaceMembers만 쓴다. */
export const getWorkspaceMembers = cache(async function getWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMemberInfo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_member")
    .select(WORKSPACE_MEMBER_SELECT)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  return mapWorkspaceMembers(data ?? []);
});
