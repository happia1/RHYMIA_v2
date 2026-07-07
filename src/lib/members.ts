export interface WorkspaceMemberInfo {
  user_id: string;
  display_name: string;
  avatar_color: string;
  avatar_text_color: string;
  avatar_image_url: string | null;
}

interface RawUserEmbed {
  avatar_color?: string | null;
  avatar_text_color?: string | null;
  avatar_image_url?: string | null;
}

interface RawMemberRow {
  user_id: string;
  display_name: string | null;
  users: RawUserEmbed | RawUserEmbed[] | null;
}

/** workspace_member + 임베드된 users(avatar_color, avatar_text_color, avatar_image_url) 행을
 * 화면에서 바로 쓰는 형태로 변환합니다. Supabase JS는 1:1 관계도 배열로 반환할 수 있어 방어 처리합니다. */
export function mapWorkspaceMembers(rows: RawMemberRow[]): WorkspaceMemberInfo[] {
  return rows.map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id,
      display_name: m.display_name ?? "가족",
      avatar_color: u?.avatar_color ?? "#E1F5EE",
      avatar_text_color: u?.avatar_text_color ?? "#0F6E56",
      avatar_image_url: u?.avatar_image_url ?? null,
    };
  });
}
