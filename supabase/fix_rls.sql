-- fridge: 누락된 RLS 정책 패치
-- 이미 테이블을 만든 상태에서 안전하게 재실행할 수 있습니다.
-- Supabase SQL Editor에서 실행하세요.

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
DROP POLICY IF EXISTS "workspace_insert" ON family_workspace;
CREATE POLICY "workspace_insert" ON family_workspace FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "workspace_select" ON family_workspace;
CREATE POLICY "workspace_select" ON family_workspace FOR SELECT
USING (is_workspace_member(id));

DROP POLICY IF EXISTS "workspace_update" ON family_workspace;
CREATE POLICY "workspace_update" ON family_workspace FOR UPDATE
USING (is_workspace_member(id));

-- workspace_member: 같은 워크스페이스 멤버끼리 서로 조회 가능, 본인 행만 추가/삭제
DROP POLICY IF EXISTS "member_select" ON workspace_member;
CREATE POLICY "member_select" ON workspace_member FOR SELECT
USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "member_insert" ON workspace_member;
CREATE POLICY "member_insert" ON workspace_member FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "member_delete" ON workspace_member;
CREATE POLICY "member_delete" ON workspace_member FOR DELETE
USING (user_id = auth.uid());

-- meal 하위 테이블 (meal_participation / meal_like / meal_comment)은
-- 원본 PRD SQL에는 정책이 없었으므로 함께 추가합니다.
DROP POLICY IF EXISTS "workspace_access" ON meal_participation;
CREATE POLICY "workspace_access" ON meal_participation FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal WHERE meal.id = meal_id AND is_workspace_member(meal.workspace_id))
);

DROP POLICY IF EXISTS "workspace_access" ON meal_like;
CREATE POLICY "workspace_access" ON meal_like FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal WHERE meal.id = meal_id AND is_workspace_member(meal.workspace_id))
);

DROP POLICY IF EXISTS "workspace_access" ON meal_comment;
CREATE POLICY "workspace_access" ON meal_comment FOR ALL
USING (
  EXISTS (SELECT 1 FROM meal WHERE meal.id = meal_id AND is_workspace_member(meal.workspace_id))
);

-- routine: 루틴 저장(upsert)에 필요한 유니크 제약 (이미 있으면 무시)
DO $$
BEGIN
  ALTER TABLE routine ADD CONSTRAINT routine_user_day_semester_key
    UNIQUE (user_id, day_of_week, semester);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
