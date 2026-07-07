-- fridge: 다이어리/습관/할일 신규 테이블 + 일정(schedule) 컬럼 추가
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

-- 다이어리 (workspace 공유, 사진/기분/날씨 기록)
CREATE TABLE IF NOT EXISTS diary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  weather TEXT,
  mood TEXT,
  photo_url TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE diary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON diary;
CREATE POLICY "workspace_access" ON diary FOR ALL
USING (is_workspace_member(workspace_id));

-- 습관 (개인 전용, routine과 별도)
CREATE TABLE IF NOT EXISTS habit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME,
  repeat_type TEXT DEFAULT 'daily',
  repeat_days INT[] DEFAULT '{}',
  target_duration TEXT,
  notify_enabled BOOLEAN DEFAULT false,
  notify_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE habit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_habit" ON habit;
CREATE POLICY "own_habit" ON habit FOR ALL
USING (user_id = auth.uid());

-- 할 일 (workspace 공유, 태그/색상 필터링용)
CREATE TABLE IF NOT EXISTS todo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  due_date DATE,
  description TEXT,
  notify_enabled BOOLEAN DEFAULT false,
  repeat_type TEXT,
  tag TEXT,
  color TEXT DEFAULT '#888780',
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE todo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON todo;
CREATE POLICY "workspace_access" ON todo FOR ALL
USING (is_workspace_member(workspace_id));

-- 일정(schedule) 확장: 종일 여부, 사진, 알림 옵션
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT true;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS notify_offset TEXT;
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS notify_custom_at TIMESTAMPTZ;
