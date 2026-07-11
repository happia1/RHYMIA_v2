-- fridge: 장보기 완료의 구매처를 memo 겸용이 아니라 전용 place 컬럼에 저장
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

ALTER TABLE expense ADD COLUMN IF NOT EXISTS place TEXT;

-- 기존에 memo에 구매처를 넣어뒀던 grocery 행들을 place로 백필(멱등 — 이미 place가 있으면 건드리지 않음, memo는 보존)
UPDATE expense
SET place = memo
WHERE category = 'grocery' AND place IS NULL AND memo IS NOT NULL;

-- 장보기 기록 탭에서 회차별 품목을 expense_id IN (...) 한 번에 조회하므로 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_shopping_item_expense_id ON shopping_item(expense_id);
