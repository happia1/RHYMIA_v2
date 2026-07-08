export interface MemberInfo {
  display_name: string;
  avatar_color: string;
}

/** 일정의 target_members를 화면에 보여줄 대상 라벨로 변환. 홈/일정 탭 리스트에서 공용으로 쓴다. */
export function targetLabel(
  targetMembers: string[],
  membersById: Record<string, MemberInfo>
) {
  if (targetMembers.length === 0) return "가족";
  if (targetMembers.length === 1) {
    return membersById[targetMembers[0]]?.display_name ?? "가족";
  }
  return `가족 외 ${targetMembers.length}`;
}
