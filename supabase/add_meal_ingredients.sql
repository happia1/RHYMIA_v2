-- fridge: 끼니 등록 시 "집에 뭐 있지"에서 고른 재료를 저장 — 냉장고 재고(fridge_item)와는
-- 별개로, 그 끼니에 실제로 쓴 재료명만 배열로 남겨둔다(구조화된 참조가 아니라 스냅샷 텍스트).
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

ALTER TABLE meal ADD COLUMN IF NOT EXISTS ingredients TEXT[] NOT NULL DEFAULT '{}';
