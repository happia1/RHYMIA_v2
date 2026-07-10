/** managed 멤버는 avatar_text_color 컬럼이 없어 고정 대비색을 사용한다 (파스텔 아바타 배경 위 텍스트). */
export const MANAGED_AVATAR_TEXT_COLOR = "#1A1A18";

export interface WorkspaceMemberInfo {
  /** workspace_member.id — target_members/routine.member_id가 가리키는 식별자 */
  id: string;
  /** account 멤버만 존재, managed(계정 없는 관리 멤버)는 null */
  user_id: string | null;
  member_type: "account" | "managed";
  /** 통일된 표시 이름: account → display_name, managed → name */
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
  birth_year: number | null;
  /** 2026-07-11 추가 — 일정 탭 상단 "내 루틴" 위젯 표시 여부. 컬럼이 없던 시절 데이터는 true로 취급. */
  routine_enabled: boolean;
}

interface RawUserEmbed {
  avatar_color?: string | null;
  avatar_text_color?: string | null;
  avatar_image_url?: string | null;
}

interface RawMemberRow {
  id: string;
  user_id?: string | null;
  member_type?: string | null;
  display_name?: string | null;
  name?: string | null;
  avatar_color?: string | null;
  avatar_image_url?: string | null;
  birth_year?: number | null;
  routine_enabled?: boolean | null;
  users?: RawUserEmbed | RawUserEmbed[] | null;
}

/** workspace_member(+ managed 전용 컬럼, + 임베드된 users) 행을 화면에서 바로 쓰는 형태로 변환합니다.
 * account/managed 두 종류를 하나의 통일된 형태로 합쳐서 반환 — 호출부는 타입을 신경 쓸 필요 없이
 * display_name/avatar_* 필드만 읽으면 된다. Supabase JS는 1:1 관계도 배열로 반환할 수 있어 방어 처리한다. */
export function mapWorkspaceMembers(rows: RawMemberRow[]): WorkspaceMemberInfo[] {
  return rows.map((m) => {
    const isManaged = m.member_type === "managed";
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      id: m.id,
      user_id: m.user_id ?? null,
      member_type: isManaged ? "managed" : "account",
      display_name: (isManaged ? m.name : m.display_name) ?? "가족",
      avatar_color: (isManaged ? m.avatar_color : u?.avatar_color) ?? "#E1F5EE",
      avatar_text_color: isManaged
        ? MANAGED_AVATAR_TEXT_COLOR
        : u?.avatar_text_color ?? "#0F6E56",
      avatar_image_url: (isManaged ? m.avatar_image_url : u?.avatar_image_url) ?? null,
      birth_year: m.birth_year ?? null,
      routine_enabled: m.routine_enabled ?? true,
    };
  });
}
