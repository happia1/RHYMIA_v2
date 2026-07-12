-- 끼니(meal)에 영양 정보(추정) 컬럼 추가.
-- kcal_min/kcal_max: 일반적인 1인분 기준 추정 칼로리 범위. macro_carb/macro_protein/macro_fat:
-- 탄수화물/단백질/지방 비율(%), 세 값의 합은 100. nutrition_source는 지금은 항상 'estimate'만
-- 쓰이지만(에이전트 추정), 나중에 수동 입력 등 다른 출처가 생길 걸 대비해 문자열로 남겨둔다.
-- 재실행 안전.

ALTER TABLE meal ADD COLUMN IF NOT EXISTS kcal_min INT;
ALTER TABLE meal ADD COLUMN IF NOT EXISTS kcal_max INT;
ALTER TABLE meal ADD COLUMN IF NOT EXISTS macro_carb INT;
ALTER TABLE meal ADD COLUMN IF NOT EXISTS macro_protein INT;
ALTER TABLE meal ADD COLUMN IF NOT EXISTS macro_fat INT;
ALTER TABLE meal ADD COLUMN IF NOT EXISTS nutrition_source TEXT DEFAULT 'estimate';
