-- fridge: "계정 없는 가족 구성원(자녀) 프로필" 지원
-- workspace_member를 넷플릭스 프로필처럼 "계정 보유(account)"와 "계정 없는 관리 멤버(managed)"가
-- 공존하는 구조로 확장하고, routine/schedule이 이제 workspace_member.id를 기준으로 삼도록 전환합니다.
--
-- ⚠️ routine.user_id 컬럼을 삭제하는, 되돌리기 어려운 단계가 포함되어 있습니다.
--    전체를 하나의 트랜잭션(BEGIN ~ COMMIT)으로 묶었고, 백필이 안 된 행이 하나라도 남아있으면
--    자동으로 중단(롤백)되도록 안전장치를 넣었습니다. 그래도 실행 전 Supabase 대시보드에서
--    최근 백업 시점을 한 번 확인해두는 걸 권장합니다.
--
-- Supabase SQL Editor에서 이 파일 전체를 한 번에 실행하세요.

-- ============================================================
-- [실행 전 확인 쿼리] 실행 전 참고용으로 먼저 돌려서 결과를 기록해두세요.
-- (member_type 컬럼은 이 마이그레이션이 만들기 전이라 아직 없으므로, 전체 멤버 수만 확인합니다.)
--
--   SELECT count(*) AS member_count FROM workspace_member;
--   SELECT count(*) AS routine_count FROM routine;
--   SELECT count(*) AS schedule_with_targets
--   FROM schedule WHERE array_length(target_members, 1) > 0;
-- ============================================================

BEGIN;

-- ============================================================
-- 1) workspace_member 확장
-- ============================================================

-- 관리 멤버는 로그인 계정이 없으므로 user_id가 NULL이어야 함
ALTER TABLE workspace_member ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE workspace_member ADD COLUMN IF NOT EXISTS member_type TEXT NOT NULL DEFAULT 'account';
ALTER TABLE workspace_member ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE workspace_member ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE workspace_member ADD COLUMN IF NOT EXISTS avatar_image_url TEXT;
ALTER TABLE workspace_member ADD COLUMN IF NOT EXISTS birth_year INT;

DO $$
BEGIN
  ALTER TABLE workspace_member
    ADD CONSTRAINT workspace_member_type_check
    CHECK (member_type IN ('account', 'managed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- member_type='account'면 user_id 필수, 'managed'면 user_id는 반드시 NULL
DO $$
BEGIN
  ALTER TABLE workspace_member
    ADD CONSTRAINT workspace_member_type_user_id_check
    CHECK (
      (member_type = 'account' AND user_id IS NOT NULL) OR
      (member_type = 'managed' AND user_id IS NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 기존 UNIQUE(workspace_id, user_id)를 "user_id가 있는 행에만" 적용되는 partial unique
-- index로 전환 (managed 멤버는 user_id가 전부 NULL이라 여러 명이어도 충돌하면 안 됨).
ALTER TABLE workspace_member DROP CONSTRAINT IF EXISTS workspace_member_workspace_user_key;
CREATE UNIQUE INDEX IF NOT EXISTS workspace_member_workspace_user_uniq
  ON workspace_member(workspace_id, user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON COLUMN workspace_member.member_type IS
  'account = 로그인 계정 보유 멤버, managed = 계정 없는 관리 멤버(자녀 등)';
COMMENT ON COLUMN workspace_member.name IS
  'managed 멤버 전용 이름. account 멤버는 기존처럼 display_name을 사용.';
COMMENT ON COLUMN workspace_member.avatar_color IS
  'managed 멤버 전용 아바타 배경색. account 멤버는 users.avatar_color를 사용.';
COMMENT ON COLUMN workspace_member.avatar_image_url IS
  'managed 멤버 전용 아바타 이미지. account 멤버는 users.avatar_image_url을 사용.';
COMMENT ON COLUMN workspace_member.birth_year IS
  '관리 멤버(주로 자녀)의 출생연도 — 나이 표시용, 선택 입력.';

-- ---------- workspace_member RLS 재작성 (managed 멤버 추가/수정/삭제 허용) ----------
-- member_select(같은 워크스페이스면 전체 조회 가능)는 계정/관리 구분 없이 이미 맞으므로 변경 없음.

DROP POLICY IF EXISTS "member_insert" ON workspace_member;
CREATE POLICY "member_insert" ON workspace_member FOR INSERT TO authenticated
WITH CHECK (
  (member_type = 'account' AND user_id = auth.uid())
  OR (member_type = 'managed' AND is_workspace_member(workspace_id))
);

DROP POLICY IF EXISTS "member_update" ON workspace_member;
CREATE POLICY "member_update" ON workspace_member FOR UPDATE TO authenticated
USING (
  (member_type = 'account' AND user_id = auth.uid())
  OR (member_type = 'managed' AND is_workspace_member(workspace_id))
)
WITH CHECK (
  (member_type = 'account' AND user_id = auth.uid())
  OR (member_type = 'managed' AND is_workspace_member(workspace_id))
);

DROP POLICY IF EXISTS "member_delete" ON workspace_member;
CREATE POLICY "member_delete" ON workspace_member FOR DELETE TO authenticated
USING (
  (member_type = 'account' AND user_id = auth.uid())
  OR (member_type = 'managed' AND is_workspace_member(workspace_id))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_member TO authenticated;

-- ============================================================
-- 2) routine: user_id → member_id 전환
-- ============================================================

ALTER TABLE routine ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES workspace_member(id) ON DELETE CASCADE;

-- 기존 user_id 데이터를 해당 유저의 workspace_member.id로 백필.
-- (한 유저가 여러 워크스페이스에 속해 있으면 그중 하나가 임의로 선택될 수 있습니다 —
--  베타 단계에서는 "유저당 워크스페이스 1개"를 가정하므로 실질적으로 문제되지 않습니다.)
UPDATE routine r
SET member_id = wm.id
FROM workspace_member wm
WHERE wm.user_id = r.user_id
  AND r.member_id IS NULL;

-- 안전장치: 백필 안 된 행이 하나라도 남아있으면 여기서 예외를 던져 전체를 롤백합니다
-- (아래의 user_id 컬럼 삭제까지 진행하지 않도록 막는 것이 목적).
DO $$
DECLARE
  unresolved_count INT;
BEGIN
  SELECT COUNT(*) INTO unresolved_count FROM routine WHERE member_id IS NULL;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'routine %건이 workspace_member로 백필되지 않았습니다 — user_id 컬럼 삭제를 중단합니다. (원인: 해당 user_id로 가입된 workspace_member 행이 없는 routine이 있는지 확인하세요)',
      unresolved_count;
  END IF;
END $$;

-- 백필이 전부 확인된 뒤에만 진행: user_id 삭제(CASCADE로 예전 UNIQUE(user_id, day_of_week, semester)
-- 제약과 기존 "own_routine" 정책도 함께 정리됨), member_id 필수화, 새 UNIQUE 제약 추가.
ALTER TABLE routine DROP COLUMN user_id CASCADE;
ALTER TABLE routine ALTER COLUMN member_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE routine
    ADD CONSTRAINT routine_member_day_semester_key UNIQUE (member_id, day_of_week, semester);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------- routine RLS 재작성 ----------
-- 읽기: 본인 멤버 행의 루틴 + 같은 워크스페이스의 managed 멤버 루틴은 워크스페이스 멤버 누구나 가능
--       (다른 account 멤버의 루틴은 여전히 비공개 — 기존 own_routine 정책의 프라이버시 원칙 유지)
CREATE OR REPLACE FUNCTION can_read_routine(target_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_member wm
    WHERE wm.id = target_member_id
      AND is_workspace_member(wm.workspace_id)
      AND (wm.user_id = auth.uid() OR wm.member_type = 'managed')
  );
$$;

-- 쓰기: 본인 루틴은 본인만, managed 멤버 루틴은 같은 워크스페이스의 account 멤버 누구나
-- (부모가 자녀 루틴을 등록/수정하는 시나리오)
CREATE OR REPLACE FUNCTION can_write_routine(target_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_member wm
    WHERE wm.id = target_member_id
      AND (
        (wm.member_type = 'account' AND wm.user_id = auth.uid())
        OR (wm.member_type = 'managed' AND is_workspace_member(wm.workspace_id))
      )
  );
$$;

DROP POLICY IF EXISTS "own_routine" ON routine;
DROP POLICY IF EXISTS "routine_select" ON routine;
DROP POLICY IF EXISTS "routine_insert" ON routine;
DROP POLICY IF EXISTS "routine_update" ON routine;
DROP POLICY IF EXISTS "routine_delete" ON routine;

CREATE POLICY "routine_select" ON routine FOR SELECT TO authenticated
USING (can_read_routine(member_id));

CREATE POLICY "routine_insert" ON routine FOR INSERT TO authenticated
WITH CHECK (can_write_routine(member_id));

CREATE POLICY "routine_update" ON routine FOR UPDATE TO authenticated
USING (can_write_routine(member_id))
WITH CHECK (can_write_routine(member_id));

CREATE POLICY "routine_delete" ON routine FOR DELETE TO authenticated
USING (can_write_routine(member_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON routine TO authenticated;

-- ============================================================
-- 3) schedule.target_members: users.id 배열 → workspace_member.id 배열로 백필
-- ============================================================
-- schedule 자체의 RLS(workspace_id 기반, 작성자 전용 수정/삭제)는 target_members를
-- 조건으로 쓰지 않으므로 정책 변경은 필요 없고, 데이터 백필만 수행합니다.
-- 매칭되지 않는 예전 user_id(예: 이미 탈퇴한 멤버)는 배열에서 제거됩니다.

UPDATE schedule s
SET target_members = COALESCE((
  SELECT array_agg(wm.id)
  FROM unnest(s.target_members) AS old_id
  JOIN workspace_member wm ON wm.user_id = old_id AND wm.workspace_id = s.workspace_id
), '{}')
WHERE array_length(s.target_members, 1) > 0;

COMMENT ON COLUMN schedule.target_members IS
  'workspace_member.id 배열 (2026-07-09 이전 데이터는 users.id 배열이었고 이 마이그레이션이 백필함)';

COMMIT;

-- ============================================================
-- [실행 후 확인 쿼리] 정상적으로 끝났다면 아래로 결과를 확인하세요.
--
--   -- 멤버 타입별 개수 (전부 'account'로만 나오는 게 정상 — managed는 이후 UI로 추가)
--   SELECT member_type, count(*) FROM workspace_member GROUP BY member_type;
--
--   -- 루틴이 전부 member_id를 갖고 있는지 (0건이어야 정상)
--   SELECT count(*) AS null_member_id FROM routine WHERE member_id IS NULL;
--
--   -- 일정의 target_members가 workspace_member.id로 잘 치환됐는지 표본 확인
--   SELECT s.id, s.target_members, wm.display_name, wm.name
--   FROM schedule s
--   LEFT JOIN workspace_member wm ON wm.id = ANY(s.target_members)
--   WHERE array_length(s.target_members, 1) > 0
--   LIMIT 20;
-- ============================================================
