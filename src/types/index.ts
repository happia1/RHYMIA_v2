export type MealType = "집밥" | "외식" | "배달";
export type NoticeType = "sticky" | "memo" | "notice";
export type FridgeCategory = "cold" | "frozen" | "room";

export interface FamilyWorkspace {
  id: string;
  name: string;
  plan: string;
  member_limit: number;
  plan_expires_at: string | null;
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

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
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
  user_id: string;
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
}

export interface Diary {
  id: string;
  workspace_id: string;
  author_id: string | null;
  date: string;
  day_of_week: number | null;
  weather: string | null;
  mood: string | null;
  photo_url: string | null;
  content: string | null;
  created_at: string;
}

export type HabitRepeatType = "daily" | "weekly" | "monthly" | "custom";

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  start_time: string | null;
  repeat_type: HabitRepeatType;
  repeat_days: number[];
  target_duration: string | null;
  notify_enabled: boolean;
  notify_time: string | null;
  created_at: string;
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
  emoji: string;
  color: string;
  created_at: string;
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
}

export interface Notice {
  id: string;
  workspace_id: string;
  type: NoticeType;
  title: string | null;
  content: string;
  color: string;
  is_pinned: boolean;
  expire_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  workspace_id: string;
  category: string;
  amount: number;
  date: string;
  memo: string | null;
  linked_schedule_id: string | null;
  created_by: string | null;
  created_at: string;
}
