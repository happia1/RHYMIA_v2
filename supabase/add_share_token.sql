-- fridge: 외부 공유 링크를 workspace_id 대신 별도 share_token으로 전환
-- workspace_id는 초대 링크(/workspace/join/[workspaceId])에도 그대로 쓰이고
-- 다른 화면에서도 노출되는 값이라, 공개 공유 링크의 비밀값으로 재사용하면
-- 안전하지 않음(추측/유출 시 초대 링크로도 동시에 악용 가능).
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

ALTER TABLE family_workspace ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();
ALTER TABLE family_workspace ALTER COLUMN share_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS family_workspace_share_token_idx
ON family_workspace(share_token);
