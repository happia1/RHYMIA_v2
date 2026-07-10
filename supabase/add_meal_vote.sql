-- fridge: "오늘 뭐먹지" 가족 투표 기능 — meal_vote / meal_vote_ballot 신규 테이블
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- is_workspace_member() 헬퍼는 supabase/fix_rls.sql에서 이미 생성되어 있어야 합니다.

CREATE TABLE IF NOT EXISTS meal_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  candidates TEXT[] NOT NULL,
  deadline TIMESTAMPTZ,
  is_closed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_vote_ballot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID REFERENCES meal_vote(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  candidate_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vote_id, user_id)
);

ALTER TABLE meal_vote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON meal_vote;
CREATE POLICY "workspace_access" ON meal_vote FOR ALL
USING (is_workspace_member(workspace_id));

ALTER TABLE meal_vote_ballot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON meal_vote_ballot;
CREATE POLICY "workspace_access" ON meal_vote_ballot FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal_vote WHERE meal_vote.id = vote_id AND is_workspace_member(meal_vote.workspace_id))
);
