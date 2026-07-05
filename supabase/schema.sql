-- RHYMIA v2 (fridge) 초기 스키마
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE family_workspace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  member_limit INT DEFAULT 6,
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT, nickname TEXT, provider TEXT,
  avatar_color TEXT DEFAULT '#E1F5EE',
  avatar_text_color TEXT DEFAULT '#0F6E56',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  display_name TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE routine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  semester TEXT DEFAULT 'default',
  blocks JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, day_of_week, semester)
);

CREATE TABLE schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date_start DATE NOT NULL, date_end DATE,
  time_start TIME, time_end TIME,
  author_id UUID REFERENCES users(id),
  target_members UUID[] DEFAULT '{}',
  is_shared BOOLEAN DEFAULT true,
  keyword_main TEXT, keyword_sub TEXT,
  is_important BOOLEAN DEFAULT false,
  memo TEXT, supplies TEXT,
  is_grocery BOOLEAN DEFAULT false,
  place TEXT, amount INT, receipt_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  date DATE NOT NULL, tag TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('집밥','외식','배달')),
  main_menu TEXT NOT NULL,
  sides TEXT[] DEFAULT '{}',
  place TEXT, reservation_time TEXT, memo TEXT,
  author_id UUID REFERENCES users(id),
  image_url TEXT, emoji TEXT DEFAULT '🍽',
  color TEXT DEFAULT '#E1F5EE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID REFERENCES meal(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status BOOLEAN, checked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meal_id, user_id)
);

CREATE TABLE meal_like (
  meal_id UUID REFERENCES meal(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (meal_id, user_id)
);

CREATE TABLE meal_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID REFERENCES meal(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fridge_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'cold' CHECK (category IN ('cold','frozen','room')),
  added_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  is_purchased BOOLEAN DEFAULT false,
  purchased_at TIMESTAMPTZ,
  purchased_by UUID REFERENCES users(id),
  linked_schedule_id UUID REFERENCES schedule(id),
  receipt_image_url TEXT
);

CREATE TABLE notice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sticky','memo','notice')),
  title TEXT, content TEXT NOT NULL,
  color TEXT DEFAULT '#FFF9C4',
  is_pinned BOOLEAN DEFAULT false,
  expire_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount INT NOT NULL,
  date DATE NOT NULL, memo TEXT,
  linked_schedule_id UUID REFERENCES schedule(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE family_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_like ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_comment ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine ENABLE ROW LEVEL SECURITY;

-- 초대 링크 미리보기용: 비멤버도 워크스페이스 이름만 확인 가능
CREATE OR REPLACE FUNCTION get_workspace_name(target_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT name FROM family_workspace WHERE id = target_workspace_id;
$$;

-- 멤버십 확인 헬퍼 함수 (SECURITY DEFINER로 workspace_member 자기 참조 재귀 문제 회피)
CREATE OR REPLACE FUNCTION is_workspace_member(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_member
    WHERE workspace_id = target_workspace_id
      AND user_id = auth.uid()
  );
$$;

-- family_workspace: 로그인 사용자는 생성 가능, 멤버만 조회/수정 가능
CREATE POLICY "workspace_insert" ON family_workspace FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "workspace_select" ON family_workspace FOR SELECT
USING (is_workspace_member(id));

CREATE POLICY "workspace_update" ON family_workspace FOR UPDATE
USING (is_workspace_member(id));

-- workspace_member: 같은 워크스페이스 멤버끼리 서로 조회 가능, 본인 행만 추가/삭제
CREATE POLICY "member_select" ON workspace_member FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY "member_insert" ON workspace_member FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "member_delete" ON workspace_member FOR DELETE
USING (user_id = auth.uid());

-- 기본 RLS 정책 (workspace 소속 데이터)
CREATE POLICY "workspace_access" ON meal FOR ALL
USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_access" ON schedule FOR ALL
USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_access" ON shopping_item FOR ALL
USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_access" ON notice FOR ALL
USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_access" ON fridge_item FOR ALL
USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_access" ON expense FOR ALL
USING (is_workspace_member(workspace_id));

CREATE POLICY "own_routine" ON routine FOR ALL
USING (user_id = auth.uid());

-- meal 하위 테이블 (meal_participation / meal_like / meal_comment)은
-- meal.workspace_id를 경유해 접근 권한을 확인합니다.
CREATE POLICY "workspace_access" ON meal_participation FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal WHERE meal.id = meal_id AND is_workspace_member(meal.workspace_id))
);

CREATE POLICY "workspace_access" ON meal_like FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal WHERE meal.id = meal_id AND is_workspace_member(meal.workspace_id))
);

CREATE POLICY "workspace_access" ON meal_comment FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal WHERE meal.id = meal_id AND is_workspace_member(meal.workspace_id))
);
