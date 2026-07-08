-- fridge: meal/schedule/notice UPDATE/DELETE를 작성자 전용으로 분리
-- 기존에는 "workspace_access" 단일 정책(FOR ALL)이라 워크스페이스 멤버라면
-- 누구든 다른 사람이 만든 meal/schedule/notice를 수정·삭제할 수 있었음.
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

-- meal
DROP POLICY IF EXISTS "workspace_access" ON meal;
DROP POLICY IF EXISTS "meal_select" ON meal;
DROP POLICY IF EXISTS "meal_insert" ON meal;
DROP POLICY IF EXISTS "meal_update" ON meal;
DROP POLICY IF EXISTS "meal_delete" ON meal;

CREATE POLICY "meal_select" ON meal FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY "meal_insert" ON meal FOR INSERT
WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "meal_update" ON meal FOR UPDATE
USING (author_id = auth.uid());

CREATE POLICY "meal_delete" ON meal FOR DELETE
USING (author_id = auth.uid());

-- schedule
DROP POLICY IF EXISTS "workspace_access" ON schedule;
DROP POLICY IF EXISTS "schedule_select" ON schedule;
DROP POLICY IF EXISTS "schedule_insert" ON schedule;
DROP POLICY IF EXISTS "schedule_update" ON schedule;
DROP POLICY IF EXISTS "schedule_delete" ON schedule;

CREATE POLICY "schedule_select" ON schedule FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY "schedule_insert" ON schedule FOR INSERT
WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "schedule_update" ON schedule FOR UPDATE
USING (author_id = auth.uid());

CREATE POLICY "schedule_delete" ON schedule FOR DELETE
USING (author_id = auth.uid());

-- notice
DROP POLICY IF EXISTS "workspace_access" ON notice;
DROP POLICY IF EXISTS "notice_select" ON notice;
DROP POLICY IF EXISTS "notice_insert" ON notice;
DROP POLICY IF EXISTS "notice_update" ON notice;
DROP POLICY IF EXISTS "notice_delete" ON notice;

CREATE POLICY "notice_select" ON notice FOR SELECT
USING (is_workspace_member(workspace_id));

CREATE POLICY "notice_insert" ON notice FOR INSERT
WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "notice_update" ON notice FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "notice_delete" ON notice FOR DELETE
USING (created_by = auth.uid());
