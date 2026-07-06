-- fridge: family_workspace INSERT 정책이 계속 막힐 때 진단 + 재적용
-- Supabase SQL Editor에서 실행하세요. 1번 결과를 먼저 확인해 주세요.

-- 1) 진단: 정책과 RLS 상태, 권한(GRANT)이 실제로 어떻게 되어 있는지 확인
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename IN ('family_workspace', 'workspace_member');

SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN ('family_workspace', 'workspace_member');

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('family_workspace', 'workspace_member')
  AND grantee IN ('authenticated', 'anon');

-- 2) 정책 재생성: role을 authenticated로 명시
DROP POLICY IF EXISTS "workspace_insert" ON family_workspace;
CREATE POLICY "workspace_insert" ON family_workspace
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "workspace_select" ON family_workspace;
CREATE POLICY "workspace_select" ON family_workspace
  FOR SELECT TO authenticated
  USING (is_workspace_member(id));

DROP POLICY IF EXISTS "workspace_update" ON family_workspace;
CREATE POLICY "workspace_update" ON family_workspace
  FOR UPDATE TO authenticated
  USING (is_workspace_member(id));

DROP POLICY IF EXISTS "member_select" ON workspace_member;
CREATE POLICY "member_select" ON workspace_member
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "member_insert" ON workspace_member;
CREATE POLICY "member_insert" ON workspace_member
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "member_delete" ON workspace_member;
CREATE POLICY "member_delete" ON workspace_member
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3) 핵심: RLS 정책은 GRANT가 있어야 평가됩니다.
--    SQL Editor로 테이블을 만든 경우 authenticated/anon에 권한이 없을 수 있습니다.
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON family_workspace TO authenticated;
GRANT SELECT, INSERT, DELETE ON workspace_member TO authenticated;
