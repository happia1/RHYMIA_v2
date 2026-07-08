-- fridge: 한 유저가 같은 워크스페이스에 중복 가입하는 것을 DB 레벨에서도 방지
-- 앱 코드(joinWorkspace)에서 이미 가입 여부를 확인하지만, 동시 요청/레이스 컨디션에
-- 대비해 DB 제약으로도 막아둔다.
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

DO $$
BEGIN
  ALTER TABLE workspace_member
    ADD CONSTRAINT workspace_member_workspace_user_key UNIQUE (workspace_id, user_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
