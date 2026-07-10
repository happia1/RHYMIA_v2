-- fridge: "하고싶은 말"(스티커) 좋아요 — notice_like 신규 테이블
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- meal_like(schema.sql)와 동일한 복합 PK 패턴, notice_comment(add_notice_comment_and_avatar_storage.sql)와
-- 동일한 "notice를 경유한 워크스페이스 확인" RLS 패턴을 그대로 따릅니다.

CREATE TABLE IF NOT EXISTS notice_like (
  notice_id UUID REFERENCES notice(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (notice_id, user_id)
);

ALTER TABLE notice_like ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON notice_like;
CREATE POLICY "workspace_access" ON notice_like FOR ALL
USING (
  EXISTS (SELECT 1 FROM notice WHERE notice.id = notice_id AND is_workspace_member(notice.workspace_id))
);
