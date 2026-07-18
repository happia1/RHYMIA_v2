-- fridge: 끼니 등록 화면 "레시피 찾아보기"의 레시피 노트(즐겨찾기) + 최근 본 레시피 기록
-- recipe_note 신규 테이블. Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
-- is_workspace_member() 헬퍼는 supabase/fix_rls.sql에서 이미 생성되어 있어야 합니다.

CREATE TABLE IF NOT EXISTS recipe_note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES family_workspace(id) ON DELETE CASCADE,
  -- 레시피 출처 — 현재는 "foodsafety"(식품안전나라 COOKRCP01)만 쓰지만, 나중에 다른
  -- 소스가 추가될 걸 대비해 문자열로 열어둠.
  source TEXT NOT NULL,
  -- 그 소스 안에서의 원본 식별자(식품안전나라면 RCP_SEQ) — source와 묶어 UNIQUE.
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  -- 상세 화면을 다시 그릴 때 외부 API를 재호출하지 않도록 NormalizedRecipe 전체를 스냅샷으로 저장.
  data JSONB NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  -- 상세를 열 때마다 갱신 — "최근 본 레시피" 정렬 기준. 즐겨찾기만 하고 상세를 연 적
  -- 없으면 NULL일 수 있음(즐겨찾기 목록 표시엔 영향 없음).
  last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS recipe_note_workspace_favorite_idx
  ON recipe_note (workspace_id, is_favorite);
CREATE INDEX IF NOT EXISTS recipe_note_workspace_last_viewed_idx
  ON recipe_note (workspace_id, last_viewed_at DESC);

ALTER TABLE recipe_note ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_access" ON recipe_note;
CREATE POLICY "workspace_access" ON recipe_note FOR ALL
USING (is_workspace_member(workspace_id));
