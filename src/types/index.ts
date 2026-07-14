export type MealType = "집밥" | "외식" | "배달";
export type NoticeType = "sticky" | "memo" | "notice";
export type FridgeCategory = "cold" | "frozen" | "room";
export type RecurType = "none" | "weekly" | "monthly" | "yearly";
export type RecurCalendar = "solar" | "lunar";

export interface FamilyWorkspace {
  id: string;
  name: string;
  plan: string;
  member_limit: number;
  plan_expires_at: string | null;
  share_token: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string | null;
  nickname: string | null;
  provider: string | null;
  avatar_color: string;
  avatar_text_color: string;
  created_at: string;
}

export type MemberType = "account" | "managed";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  /** account 멤버만 존재, managed(계정 없는 관리 멤버)는 null */
  user_id: string | null;
  role: string;
  member_type: MemberType;
  display_name: string | null;
  /** managed 멤버 전용 이름. account 멤버는 display_name을 사용. */
  name: string | null;
  /** managed 멤버 전용 아바타. account 멤버는 users.avatar_color/avatar_image_url을 사용. */
  avatar_color: string | null;
  avatar_image_url: string | null;
  birth_year: number | null;
  joined_at: string;
}

export interface RoutineBlockRepeat {
  type: "weekly" | "monthly" | "yearly";
  days?: number[];
  end_date?: string;
}

export interface RoutineBlock {
  start: string;
  end: string;
  status: string;
  label: string;
  memo?: string;
  repeat?: RoutineBlockRepeat;
}

export interface Routine {
  id: string;
  /** workspace_member.id — 2026-07-09 이전엔 user_id였음 (add_managed_members.sql 참고) */
  member_id: string;
  day_of_week: number;
  semester: string;
  blocks: RoutineBlock[];
  updated_at: string;
}

export type NotifyOffset = "same_day_morning" | "day_before" | "week_before" | "custom";

export interface Schedule {
  id: string;
  workspace_id: string;
  title: string;
  date_start: string;
  date_end: string | null;
  time_start: string | null;
  time_end: string | null;
  author_id: string | null;
  /** workspace_member.id 배열 (2026-07-09 이전엔 users.id 배열이었음) */
  target_members: string[];
  is_shared: boolean;
  keyword_main: string | null;
  keyword_sub: string | null;
  is_important: boolean;
  memo: string | null;
  /** @deprecated 새 일정은 memo에 통합 저장됩니다. 과거 데이터 호환용으로만 남겨둡니다. */
  supplies: string | null;
  is_grocery: boolean;
  place: string | null;
  amount: number | null;
  receipt_image_url: string | null;
  is_all_day: boolean;
  image_url: string | null;
  notify_offset: NotifyOffset | null;
  notify_custom_at: string | null;
  created_at: string;
  /** 2026-07-12 추가 — 반복 일정(기념일·생신 등). weekly는 없음(루틴이 전담) */
  recur_type: RecurType;
  recur_calendar: RecurCalendar;
  recur_until: string | null;
}

export interface Todo {
  id: string;
  workspace_id: string;
  author_id: string | null;
  title: string;
  due_date: string | null;
  description: string | null;
  notify_enabled: boolean;
  repeat_type: string | null;
  tag: string | null;
  color: string;
  is_done: boolean;
  created_at: string;
}

export interface Meal {
  id: string;
  workspace_id: string;
  date: string;
  tag: string;
  type: MealType;
  main_menu: string;
  sides: string[];
  place: string | null;
  reservation_time: string | null;
  memo: string | null;
  author_id: string | null;
  image_url: string | null;
  /** 붙여넣은 유튜브 레시피 링크의 영상 id — 썸네일은 저장하지 않고 youtubeThumbnailUrl()로 참조만 함 */
  video_id: string | null;
  recipe_title: string | null;
  /** 블로그 레시피 검색 결과에서 저장한 글 링크 — video_id(유튜브)와 공존 가능,
   * 본문은 저장하지 않고(저작권) 링크만 보관한다 */
  recipe_url: string | null;
  emoji: string;
  color: string;
  created_at: string;
  /** 아래 5개는 2026-07-12 추가 — 에이전트가 메뉴명 기준으로 추정한 영양 정보(참고용).
   * 저장 실패 시 전부 null일 수 있음(끼니 저장과 무관한 부가 정보). */
  kcal_min: number | null;
  kcal_max: number | null;
  /** 탄수화물/단백질/지방 비율(%), 셋의 합은 100 */
  macro_carb: number | null;
  macro_protein: number | null;
  macro_fat: number | null;
  nutrition_source: string | null;
}

/** 에이전트 /estimate-nutrition 응답 — meal.kcal_min 등 5개 컬럼과 1:1 대응 */
export interface MealNutritionEstimate {
  kcal_min: number | null;
  kcal_max: number | null;
  macro_carb: number | null;
  macro_protein: number | null;
  macro_fat: number | null;
}

export interface MealParticipation {
  id: string;
  meal_id: string;
  user_id: string;
  status: boolean | null;
  checked_at: string;
}

export interface MealLike {
  meal_id: string;
  user_id: string;
}

export interface MealComment {
  id: string;
  meal_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

/** "대신 골라줘" 가족 투표 모드 — 2026-07-11 추가 */
export interface MealVoteBallot {
  id: string;
  vote_id: string;
  user_id: string;
  candidate_index: number;
  created_at: string;
}

export interface MealVote {
  id: string;
  workspace_id: string;
  date: string;
  candidates: string[];
  deadline: string | null;
  is_closed: boolean;
  created_by: string | null;
  created_at: string;
  meal_vote_ballot?: MealVoteBallot[];
}

export interface FridgeItem {
  id: string;
  workspace_id: string;
  name: string;
  category: FridgeCategory;
  added_by: string | null;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  workspace_id: string;
  name: string;
  added_by: string | null;
  added_at: string;
  is_purchased: boolean;
  purchased_at: string | null;
  purchased_by: string | null;
  linked_schedule_id: string | null;
  receipt_image_url: string | null;
  /** "장보기 완료"로 묶인 expense — 2026-07-11 추가. NULL이면 아직 그룹핑되지 않은 구매 완료 항목 */
  expense_id: string | null;
}

export interface Notice {
  id: string;
  workspace_id: string;
  type: NoticeType;
  title: string | null;
  content: string;
  color: string;
  /** 2026-07-11 추가. sticky/memo/notice 전부 이미지 삽입 가능(별도로 "사진에서 텍스트 채우기"를 쓰면
   * 이미지 자체는 저장하지 않고 Gemini로 텍스트만 추출해 본문에 채워 넣음) */
  image_url: string | null;
  is_pinned: boolean;
  expire_at: string | null;
  created_by: string | null;
  created_at: string;
  /** "하고싶은 말"(sticky) 좋아요 임베드 — 2026-07-11 추가. `notice_like(user_id)` 조회 시에만 채워짐 */
  notice_like?: { user_id: string }[];
}

export interface NoticeLike {
  notice_id: string;
  user_id: string;
  created_at: string;
}

export interface NoticeComment {
  id: string;
  notice_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Expense {
  id: string;
  workspace_id: string;
  category: string;
  amount: number;
  date: string;
  memo: string | null;
  /** 2026-07-11 추가 — "장보기 완료"의 구매처. 이전엔 memo에 겸용으로 넣었으나 전용 컬럼으로 분리 */
  place: string | null;
  linked_schedule_id: string | null;
  /** 2026-07-11 추가 — "장보기 완료" 시 첨부한 영수증 사진. OCR 파싱은 P2 범위 밖, URL 저장만 */
  receipt_image_url: string | null;
  created_by: string | null;
  created_at: string;
}
